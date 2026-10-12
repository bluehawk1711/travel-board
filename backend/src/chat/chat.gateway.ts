import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Redis } from '@upstash/redis';
import type { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { createJwtSocketAuth, SocketData } from '../common/ws/jwt-socket-auth';
import { ChatService, MessagePayload } from './chat.service';

/**
 * Shared realtime gateway — chat now, board co-editing next (plan.md §4.5).
 * JWT is verified on the handshake; membership checks happen per event so a
 * user only ever receives data for conversations they belong to.
 */
@WebSocketGateway({
  cors: {
    // Decorators run before DI — read env directly (mirrors main.ts fallback).
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
@Injectable()
export class ChatGateway
  implements
    OnModuleInit,
    OnModuleDestroy,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  /** Per-socket flood guard: socketId -> timestamps of recent message:send calls. */
  private readonly sendLog = new Map<string, number[]>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.server.use(createJwtSocketAuth(this.jwtService));
  }

  onModuleDestroy(): void {
    void this.server.close();
  }

  async handleConnection(socket: Socket): Promise<void> {
    const userId = this.userId(socket);
    try {
      // Join every conversation room the user is a member of.
      const ids = await this.chatService.getUserConversationIds(userId);
      for (const id of ids) {
        await socket.join(ChatService.room(id));
      }
      await this.chatService.setOnline(userId);
    } catch (err) {
      // Room auto-join is best-effort; explicit conversation:join re-checks
      // membership anyway, and presence failures are logged not thrown.
      this.logger.warn(
        `socket room join failed for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = this.userId(socket);
    if (userId) {
      await this.chatService.setOffline(userId);
    }
    this.sendLog.delete(socket.id);
  }

  // ── Client → Server events ────────────────────────────────

  /** Join (or re-join) a conversation room. */
  @SubscribeMessage('conversation:join')
  async handleJoin(
    socket: Socket,
    payload: { conversationId: string },
  ): Promise<{ ok: boolean }> {
    const userId = this.userId(socket);
    try {
      if (!(await this.chatService.isMember(userId, payload.conversationId))) {
        return { ok: false };
      }
      await socket.join(ChatService.room(payload.conversationId));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /** Persist + broadcast a message. Ack tells the sender it was saved. */
  @SubscribeMessage('message:send')
  async handleSendMessage(
    socket: Socket,
    payload: { conversationId: string; body: string; clientId?: string },
  ): Promise<{ ok: boolean; message?: MessagePayload; error?: string }> {
    const userId = this.userId(socket);
    if (this.isFlooding(socket.id)) {
      return { ok: false, error: 'Slow down — too many messages' };
    }
    try {
      const message = await this.chatService.sendMessage(
        userId,
        payload.conversationId,
        payload.body,
      );
      this.server
        .to(ChatService.room(payload.conversationId))
        .emit('message:new', { ...message, clientId: payload.clientId });
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Broadcast typing indicator to everyone else in the room. */
  @SubscribeMessage('message:typing')
  async handleTyping(
    socket: Socket,
    payload: { conversationId: string },
  ): Promise<{ ok: boolean }> {
    const userId = this.userId(socket);
    try {
      if (!(await this.chatService.isMember(userId, payload.conversationId))) {
        return { ok: false };
      }
      socket.to(ChatService.room(payload.conversationId)).emit('user:typing', {
        conversationId: payload.conversationId,
        userId,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /** Mark a conversation read up to lastMessageId. */
  @SubscribeMessage('message:read')
  async handleRead(
    socket: Socket,
    payload: { conversationId: string; lastMessageId: number },
  ): Promise<{ ok: boolean }> {
    const userId = this.userId(socket);
    try {
      await this.chatService.markRead(
        userId,
        payload.conversationId,
        payload.lastMessageId,
      );
      socket
        .to(ChatService.room(payload.conversationId))
        .emit('conversation:read', {
          conversationId: payload.conversationId,
          userId,
          lastMessageId: payload.lastMessageId,
        });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  // ── Server → Client broadcasts (also used by REST fallbacks) ──

  /** Broadcast a persisted message (e.g. one sent via the REST fallback). */
  broadcastMessage(message: MessagePayload): void {
    this.server
      .to(ChatService.room(message.conversationId))
      .emit('message:new', message);
  }

  // ── Helpers ───────────────────────────────────────────────

  private userId(socket: Socket): string {
    return (socket.data as SocketData).userId;
  }

  private isFlooding(socketId: string): boolean {
    const now = Date.now();
    const windowMs = 10_000;
    const maxPerWindow = 20;
    const recent = (this.sendLog.get(socketId) ?? []).filter(
      (t) => now - t < windowMs,
    );
    if (recent.length >= maxPerWindow) {
      this.sendLog.set(socketId, recent);
      return true;
    }
    recent.push(now);
    this.sendLog.set(socketId, recent);
    return false;
  }
}
