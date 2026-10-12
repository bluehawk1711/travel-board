import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Redis } from '@upstash/redis';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import {
  boardMembers,
  conversationMembers,
  conversations,
  messages,
  users,
} from '../db/schema';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { MESSAGES } from '../common/messages';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

const ROOM_PREFIX = 'conv:';
const PRESENCE_TTL_SECONDS = 120;

/** Shape broadcast over sockets and returned by the REST API. */
export interface MessagePayload {
  id: number;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: Date;
}

export interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'BOARD';
  boardId: string | null;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: { userId: string; name: string; avatarUrl: string | null }[];
  lastMessage: MessagePayload | null;
  unreadCount: number;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly notifications: NotificationsService,
  ) {}

  static room(conversationId: string): string {
    return `${ROOM_PREFIX}${conversationId}`;
  }

  // ── Conversation listing & detail ─────────────────────────

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const memberRows = await this.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    if (memberRows.length === 0) {
      return [];
    }
    const convIds = memberRows.map((r) => r.conversationId);
    const convs = await this.db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds));

    const [lastMessages, unreadRows, participantRows] = await Promise.all([
      this.lastMessagePerConversation(convIds),
      this.unreadCounts(userId, convIds),
      this.participants(convIds),
    ]);

    const lastByConv = new Map(
      lastMessages.map((m) => [m.conversationId, m as MessagePayload]),
    );
    const unreadByConv = new Map(
      unreadRows.map((r) => [r.conversationId, Number(r.count)]),
    );
    const participantsByConv = new Map<
      string,
      ConversationSummary['members']
    >();
    for (const p of participantRows) {
      const list = participantsByConv.get(p.conversationId) ?? [];
      list.push({ userId: p.userId, name: p.name, avatarUrl: p.avatarUrl });
      participantsByConv.set(p.conversationId, list);
    }

    const summaries: ConversationSummary[] = convs.map((conv) => ({
      ...conv,
      members: participantsByConv.get(conv.id) ?? [],
      lastMessage: lastByConv.get(conv.id) ?? null,
      unreadCount: unreadByConv.get(conv.id) ?? 0,
    }));
    // Most recent activity first.
    summaries.sort((a, b) => {
      const aKey = a.lastMessage?.id ?? 0;
      const bKey = b.lastMessage?.id ?? 0;
      if (aKey !== bKey) {
        return bKey - aKey;
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return summaries;
  }

  async getConversationDetail(userId: string, conversationId: string) {
    const conv = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
    if (!conv) {
      throw new NotFoundException(MESSAGES.CHAT.CONVERSATION_NOT_FOUND);
    }
    await this.assertMember(userId, conversationId);
    const memberRows = await this.db
      .select({
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.conversationId, conversationId));
    return { ...conv, members: memberRows };
  }

  // ── Conversation creation ─────────────────────────────────

  async getOrCreateDirect(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException(MESSAGES.CHAT.SELF_DM);
    }
    const other = await this.db.query.users.findFirst({
      columns: { id: true },
      where: eq(users.id, otherUserId),
    });
    if (!other) {
      throw new NotFoundException(MESSAGES.CHAT.USER_NOT_FOUND);
    }

    const existing = await this.findDirectConversation(userId, otherUserId);
    if (existing) {
      return this.getConversationDetail(userId, existing.id);
    }

    const conv = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(conversations)
        .values({ type: 'DIRECT', createdBy: userId })
        .returning();
      await tx.insert(conversationMembers).values([
        { conversationId: created.id, userId },
        { conversationId: created.id, userId: otherUserId },
      ]);
      return created;
    });
    return this.getConversationDetail(userId, conv.id);
  }

  async createGroup(userId: string, dto: CreateConversationDto) {
    const memberIds = [...new Set(dto.memberIds ?? [])].filter(
      (id) => id !== userId,
    );
    if (memberIds.length === 0) {
      throw new BadRequestException(MESSAGES.CHAT.GROUP_MEMBERS_REQUIRED);
    }
    if (memberIds.length > 49) {
      throw new BadRequestException(MESSAGES.CHAT.TOO_MANY_MEMBERS);
    }
    const found = await this.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, memberIds));
    if (found.length !== memberIds.length) {
      throw new NotFoundException(MESSAGES.CHAT.USER_NOT_FOUND);
    }

    const conv = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(conversations)
        .values({ type: 'GROUP', name: dto.name ?? null, createdBy: userId })
        .returning();
      await tx.insert(conversationMembers).values([
        { conversationId: created.id, userId },
        ...memberIds.map((id) => ({
          conversationId: created.id,
          userId: id,
        })),
      ]);
      return created;
    });
    return this.getConversationDetail(userId, conv.id);
  }

  /** Per-board collaboration room — only board members may access it. */
  async getOrCreateBoardConversation(userId: string, boardId: string) {
    const membership = await this.db.query.boardMembers.findFirst({
      where: and(
        eq(boardMembers.boardId, boardId),
        eq(boardMembers.userId, userId),
      ),
    });
    if (!membership) {
      throw new ForbiddenException(MESSAGES.CHAT.NOT_BOARD_MEMBER);
    }

    const existing = await this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.type, 'BOARD'),
        eq(conversations.boardId, boardId),
      ),
    });
    if (existing) {
      // Board members added after the room was created can join it.
      await this.db
        .insert(conversationMembers)
        .values({ conversationId: existing.id, userId })
        .onConflictDoNothing();
      return this.getConversationDetail(userId, existing.id);
    }

    const conv = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(conversations)
        .values({ type: 'BOARD', boardId, createdBy: userId })
        .returning();
      const members = await tx
        .select({ userId: boardMembers.userId })
        .from(boardMembers)
        .where(eq(boardMembers.boardId, boardId));
      if (members.length > 0) {
        await tx.insert(conversationMembers).values(
          members.map((m) => ({
            conversationId: created.id,
            userId: m.userId,
          })),
        );
      }
      return created;
    });
    return this.getConversationDetail(userId, conv.id);
  }

  // ── Messages ──────────────────────────────────────────────

  async listMessages(
    userId: string,
    conversationId: string,
    cursor?: number,
    limit = 50,
  ) {
    await this.assertMember(userId, conversationId);
    const capped = Math.min(Math.max(limit, 1), 100);
    const conditions = [eq(messages.conversationId, conversationId)];
    if (cursor) {
      conditions.push(lt(messages.id, cursor));
    }

    const rows = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        senderName: users.name,
        senderAvatarUrl: users.avatarUrl,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(messages.id))
      .limit(capped + 1);

    const hasMore = rows.length > capped;
    const items = (hasMore ? rows.slice(0, capped) : rows) as MessagePayload[];
    items.reverse(); // oldest first
    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[0].id : null,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
  ): Promise<MessagePayload> {
    await this.assertMember(userId, conversationId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException(MESSAGES.CHAT.EMPTY_MESSAGE);
    }

    const [message] = await this.db
      .insert(messages)
      .values({ conversationId, senderId: userId, body: trimmed })
      .returning();
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const sender = await this.db.query.users.findFirst({
      columns: { id: true, name: true, avatarUrl: true },
      where: eq(users.id, userId),
    });

    const memberRows = await this.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
    this.notifications.notifyMany(
      memberRows.map((r) => r.userId),
      {
        type: 'NEW_CHAT_MESSAGE',
        actorId: userId,
        targetType: 'CONVERSATION',
        targetId: conversationId,
        metadata: {
          actorName: sender?.name ?? 'Someone',
          excerpt: trimmed.slice(0, 80),
        },
      },
    );

    return {
      id: message.id,
      conversationId,
      senderId: userId,
      senderName: sender?.name ?? 'Unknown',
      senderAvatarUrl: sender?.avatarUrl ?? null,
      body: trimmed,
      createdAt: message.createdAt,
    };
  }

  async markRead(
    userId: string,
    conversationId: string,
    lastMessageId: number,
  ) {
    await this.assertMember(userId, conversationId);
    await this.db
      .update(conversationMembers)
      .set({ lastReadMessageId: lastMessageId })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      );
    return { readThrough: lastMessageId };
  }

  // ── Presence ──────────────────────────────────────────────

  async setOnline(userId: string): Promise<void> {
    await this.redis
      .set(`presence:${userId}`, '1', { ex: PRESENCE_TTL_SECONDS })
      .catch(() => undefined);
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(`presence:${userId}`).catch(() => undefined);
  }

  async getPresence(userIds: string[]): Promise<Record<string, boolean>> {
    if (userIds.length === 0) {
      return {};
    }
    const keys = userIds.map((id) => `presence:${id}`);
    const values = (await this.redis.mget(...keys).catch(() => null)) ?? [];
    const result: Record<string, boolean> = {};
    userIds.forEach((id, i) => {
      result[id] = Boolean(values[i]);
    });
    return result;
  }

  // ── Membership helpers (used by the gateway) ──────────────

  async isMember(userId: string, conversationId: string): Promise<boolean> {
    const row = await this.db.query.conversationMembers.findFirst({
      columns: { conversationId: true },
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    });
    return Boolean(row);
  }

  async getUserConversationIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    return rows.map((r) => r.conversationId);
  }

  // ── Private helpers ───────────────────────────────────────

  private async assertMember(userId: string, conversationId: string) {
    if (!(await this.isMember(userId, conversationId))) {
      throw new ForbiddenException(MESSAGES.CHAT.NOT_A_MEMBER);
    }
  }

  private async findDirectConversation(userId: string, otherUserId: string) {
    const mine = await this.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    if (mine.length === 0) {
      return null;
    }
    const ids = mine.map((r) => r.conversationId);
    const theirs = await this.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.userId, otherUserId),
          inArray(conversationMembers.conversationId, ids),
        ),
      );
    if (theirs.length === 0) {
      return null;
    }
    return this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, theirs[0].conversationId),
        eq(conversations.type, 'DIRECT'),
      ),
    });
  }

  private async lastMessagePerConversation(convIds: string[]) {
    if (convIds.length === 0) {
      return [];
    }
    return this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        senderName: users.name,
        senderAvatarUrl: users.avatarUrl,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(inArray(messages.conversationId, convIds))
      .orderBy(desc(messages.id))
      .limit(50); // enough to compute per-conversation latest in JS
  }

  private async unreadCounts(userId: string, convIds: string[]) {
    if (convIds.length === 0) {
      return [];
    }
    return this.db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, messages.conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .where(
        and(
          inArray(messages.conversationId, convIds),
          or(
            isNull(conversationMembers.lastReadMessageId),
            gt(messages.id, conversationMembers.lastReadMessageId),
          ),
        ),
      )
      .groupBy(messages.conversationId);
  }

  private async participants(convIds: string[]) {
    if (convIds.length === 0) {
      return [];
    }
    return this.db
      .select({
        conversationId: conversationMembers.conversationId,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(inArray(conversationMembers.conversationId, convIds));
  }
}
