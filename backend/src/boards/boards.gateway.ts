import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Redis } from '@upstash/redis';
import type { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { createJwtSocketAuth, SocketData } from '../common/ws/jwt-socket-auth';
import type { BoardItem, BoardSection } from '../db/schema';
import { BoardsService } from './boards.service';

const activeKey = (boardId: string): string => `board:${boardId}:active`;

export type BoardChangeType =
  | 'board:updated'
  | 'board:removed'
  | 'section:created'
  | 'section:updated'
  | 'section:removed'
  | 'item:created'
  | 'item:updated'
  | 'item:removed'
  | 'items:reordered'
  | 'sections:reordered';

/**
 * Payload broadcast to a board room after any mutation. Carries the changed
 * entity when it is cheaply available (created/updated rows); otherwise just
 * the ids so clients can refetch. Clients treat it as last-write-wins.
 */
export interface BoardChangeEvent {
  type: BoardChangeType;
  boardId: string;
  actorId: string;
  /** ISO-8601 timestamp of the change. */
  at: string;
  /** Present for section:created / section:updated. */
  section?: BoardSection;
  /** Present for section:updated / section:removed. */
  sectionId?: string;
  /** Present for item:created / item:updated. */
  item?: BoardItem;
  /** Present for item:removed. */
  itemId?: string;
  /** Present for items:reordered / sections:reordered. */
  orderedItemIds?: string[];
  orderedSectionIds?: string[];
}

/**
 * Realtime co-editing gateway (plan.md §4.5). Shares the Socket.IO server with
 * ChatGateway; both run the same JWT handshake middleware. Rooms:
 *   board:{boardId} — receives `board:change` broadcasts + presence updates.
 * Presence: `board:{id}:active` Redis set (SADD on join, SREM on leave /
 * disconnect), broadcast as `board:presence` so collaborators see who's there.
 *
 * Writes happen through the REST endpoints (validated DTOs, permission checks
 * in the service layer) — the gateway is the notification layer, mirroring the
 * chat pattern where REST is the durable path and sockets broadcast.
 */
@WebSocketGateway({
  cors: {
    // Decorators run before DI — read env directly (mirrors main.ts fallback).
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
@Injectable()
export class BoardsGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(BoardsGateway.name);

  constructor(
    private readonly boardsService: BoardsService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  static room(boardId: string): string {
    return `board:${boardId}`;
  }

  onModuleInit(): void {
    this.server.use(createJwtSocketAuth(this.jwtService));
  }

  /** Clean up presence for every board room this socket had joined. */
  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = this.userId(socket);
    const boards = (socket.data as SocketData).boards;
    if (!userId || !boards || boards.size === 0) {
      return;
    }
    for (const boardId of boards) {
      await this.redis.srem(activeKey(boardId), userId).catch(() => undefined);
      await this.broadcastPresence(boardId).catch(() => undefined);
    }
  }

  /** Join a board room — public boards for anyone, private boards for members. */
  @SubscribeMessage('board:join')
  async handleJoin(
    socket: Socket,
    payload: { boardId: string },
  ): Promise<{ ok: boolean }> {
    const userId = this.userId(socket);
    try {
      if (
        !payload?.boardId ||
        !(await this.boardsService.canView(payload.boardId, userId))
      ) {
        return { ok: false };
      }
      await socket.join(BoardsGateway.room(payload.boardId));
      await this.redis
        .sadd(activeKey(payload.boardId), userId)
        .catch(() => undefined);
      const data = socket.data as SocketData;
      data.boards ??= new Set<string>();
      data.boards.add(payload.boardId);
      await this.broadcastPresence(payload.boardId);
      return { ok: true };
    } catch (err) {
      this.logger.warn(
        `board:join failed for user ${userId}: ${(err as Error).message}`,
      );
      return { ok: false };
    }
  }

  @SubscribeMessage('board:leave')
  async handleLeave(
    socket: Socket,
    payload: { boardId: string },
  ): Promise<{ ok: boolean }> {
    const userId = this.userId(socket);
    try {
      await socket.leave(BoardsGateway.room(payload.boardId));
      await this.redis
        .srem(activeKey(payload.boardId), userId)
        .catch(() => undefined);
      (socket.data as SocketData).boards?.delete(payload.boardId);
      await this.broadcastPresence(payload.boardId);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /** Server → room broadcast after any board mutation (incl. REST writes). */
  broadcastBoardChange(event: BoardChangeEvent): void {
    this.server
      .to(BoardsGateway.room(event.boardId))
      .emit('board:change', event);
  }

  private async broadcastPresence(boardId: string): Promise<void> {
    const activeUserIds = (await this.redis
      .smembers(activeKey(boardId))
      .catch(() => [])) as string[];
    this.server
      .to(BoardsGateway.room(boardId))
      .emit('board:presence', { boardId, activeUserIds });
  }

  private userId(socket: Socket): string {
    return (socket.data as SocketData).userId;
  }
}
