import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq, and, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { notifications, users } from '../db/schema';
import { PushService } from '../push/push.service';

export type NotificationType =
  | 'NEW_FOLLOWER'
  | 'NEW_BOARD_FOLLOWER'
  | 'NEW_COMMENT'
  | 'NEW_LIKE'
  | 'NEW_SAVE'
  | 'NEW_CHAT_MESSAGE'
  | 'MENTION';

export interface CreateNotificationInput {
  /** Recipient. */
  userId: string;
  type: NotificationType;
  /** Who triggered the event. */
  actorId: string;
  /** Target entity id (board, comment, conversation, …). */
  targetId?: string;
  /** Target entity type (BOARD, COMMENT, CONVERSATION, USER). */
  targetType?: string;
  /** Free-form context (actor name, board title, excerpt, …). */
  metadata?: Record<string, unknown>;
  /** Push copy; derived from type + metadata when omitted. */
  push?: { title: string; body: string };
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: { id: string; name: string; avatarUrl: string | null };
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  total: number;
}

/** Read a string out of free-form JSONB metadata without object coercion. */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Narrow a jsonb column value (typed `unknown` by Drizzle) to an object. */
function readMetadata(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * In-app notification inbox + push fan-out.
 *
 * Postgres is the source of truth; push delivery is best-effort and never
 * fails the calling business flow. Use {@link notify} from event handlers
 * (fire-and-forget) and {@link create} when the caller must await the row.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly pushService: PushService,
  ) {}

  /**
   * Fire-and-forget notification for event handlers. Swallows and logs
   * errors so the primary action (follow, comment, message) is never
   * broken by notification bookkeeping.
   */
  notify(input: CreateNotificationInput): void {
    void this.create(input).catch((error) => {
      this.logger.warn(
        `Failed to create notification for user ${input.userId}: ${String(
          error,
        )}`,
      );
    });
  }

  /**
   * Fire-and-forget fan-out to many recipients (e.g. group chat). The actor
   * is excluded automatically.
   */
  notifyMany(
    recipientIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>,
  ): void {
    const recipients = recipientIds.filter((id) => id !== input.actorId);
    if (recipients.length === 0) {
      return;
    }
    void this.createMany(recipients, input).catch((error) => {
      this.logger.warn(
        `Failed to fan out notification to ${recipients.length} user(s): ${String(
          error,
        )}`,
      );
    });
  }

  /** Insert a notification and fan out a push. Self-events are skipped. */
  async create(
    input: CreateNotificationInput,
  ): Promise<NotificationItem | null> {
    if (input.userId === input.actorId) {
      return null;
    }

    const [row] = await this.db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        actorId: input.actorId,
        targetId: input.targetId,
        targetType: input.targetType,
        metadata: input.metadata ?? undefined,
      })
      .returning();

    const copy =
      input.push ??
      this.defaultCopy({
        type: row.type,
        metadata: readMetadata(row.metadata),
      });
    void this.pushService.sendToUser(row.userId, {
      title: copy.title,
      body: copy.body,
      data: {
        type: row.type,
        notificationId: row.id,
        ...(row.targetId ? { targetId: row.targetId } : {}),
        ...(row.targetType ? { targetType: row.targetType } : {}),
        actorId: row.actorId,
      },
    });

    return this.toItem(
      {
        id: row.id,
        type: row.type,
        targetId: row.targetId,
        targetType: row.targetType,
        metadata: readMetadata(row.metadata),
        read: row.read,
        createdAt: row.createdAt,
      },
      {
        id: row.actorId,
        name: asString(input.metadata?.['actorName']) ?? 'Someone',
        avatarUrl: null,
      },
    );
  }

  /** Newest-first page of the user's inbox. */
  async listForUser(
    userId: string,
    limit = 30,
    offset = 0,
  ): Promise<NotificationListResult> {
    const parsedLimit = Math.min(Math.max(limit, 1), 100);
    const parsedOffset = Math.max(offset, 0);

    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          id: notifications.id,
          type: notifications.type,
          actorId: users.id,
          actorName: users.name,
          actorAvatar: users.avatarUrl,
          targetId: notifications.targetId,
          targetType: notifications.targetType,
          metadata: notifications.metadata,
          read: notifications.read,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .innerJoin(users, eq(notifications.actorId, users.id))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(parsedLimit)
        .offset(parsedOffset),
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(notifications)
        .where(eq(notifications.userId, userId)),
    ]);

    return {
      items: rows.map((row) =>
        this.toItem(
          {
            id: row.id,
            type: row.type,
            targetId: row.targetId,
            targetType: row.targetType,
            metadata: readMetadata(row.metadata),
            read: row.read,
            createdAt: row.createdAt,
          },
          {
            id: row.actorId,
            name: row.actorName,
            avatarUrl: row.actorAvatar,
          },
        ),
      ),
      total: Number(totalRow[0]?.total ?? 0),
    };
  }

  async unreadCount(userId: string): Promise<{ unreadCount: number }> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );
    return { unreadCount: Number(row?.count ?? 0) };
  }

  /** Mark specific notifications read (only the user's own rows). */
  async markRead(userId: string, ids: string[]): Promise<{ updated: number }> {
    if (ids.length === 0) {
      return { updated: 0 };
    }
    const result = await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.userId, userId), inArray(notifications.id, ids)),
      )
      .returning({ id: notifications.id });
    return { updated: result.length };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      )
      .returning({ id: notifications.id });
    return { updated: result.length };
  }

  // ── Internals ─────────────────────────────────────────────

  private async createMany(
    recipientIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<void> {
    const rows = await this.db
      .insert(notifications)
      .values(
        recipientIds.map((userId) => ({
          userId,
          type: input.type,
          actorId: input.actorId,
          targetId: input.targetId,
          targetType: input.targetType,
          metadata: input.metadata ?? undefined,
        })),
      )
      .returning();
    if (rows.length === 0) {
      return;
    }
    const copy =
      input.push ??
      this.defaultCopy({
        type: rows[0].type,
        metadata: readMetadata(rows[0].metadata),
      });
    void this.pushService.sendToUsers(recipientIds, {
      title: copy.title,
      body: copy.body,
      data: {
        type: input.type,
        ...(input.targetId ? { targetId: input.targetId } : {}),
        ...(input.targetType ? { targetType: input.targetType } : {}),
        actorId: input.actorId,
      },
    });
  }

  private toItem(
    row: {
      id: string;
      type: NotificationType;
      targetId: string | null;
      targetType: string | null;
      metadata: Record<string, unknown> | null;
      read: boolean;
      createdAt: Date;
    },
    actor: { id: string; name: string; avatarUrl: string | null },
  ): NotificationItem {
    return {
      id: row.id,
      type: row.type,
      actor,
      targetId: row.targetId,
      targetType: row.targetType,
      metadata: row.metadata,
      read: row.read,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Default push copy per type when the caller doesn't supply its own. */
  private defaultCopy(row: {
    type: NotificationType;
    metadata: Record<string, unknown> | null;
  }): { title: string; body: string } {
    const actorName = asString(row.metadata?.['actorName']) ?? 'Someone';
    const boardTitle = asString(row.metadata?.['boardTitle']);
    const excerpt = asString(row.metadata?.['excerpt']);

    switch (row.type) {
      case 'NEW_FOLLOWER':
        return {
          title: 'New follower',
          body: `${actorName} started following you`,
        };
      case 'NEW_BOARD_FOLLOWER':
        return {
          title: 'New board follower',
          body: boardTitle
            ? `${actorName} is now following ${boardTitle}`
            : `${actorName} is following one of your boards`,
        };
      case 'NEW_COMMENT':
        return {
          title: 'New comment',
          body: boardTitle
            ? `${actorName} commented on ${boardTitle}`
            : `${actorName} left a comment`,
        };
      case 'NEW_CHAT_MESSAGE':
        return {
          title: actorName,
          body: excerpt ?? 'You have a new message',
        };
      case 'NEW_LIKE':
        return {
          title: 'New like',
          body: boardTitle
            ? `${actorName} liked ${boardTitle}`
            : `${actorName} liked something of yours`,
        };
      case 'NEW_SAVE':
        return {
          title: 'New save',
          body: boardTitle
            ? `${actorName} saved ${boardTitle}`
            : `${actorName} saved something of yours`,
        };
      case 'MENTION':
      default:
        return { title: 'Travel Board', body: 'You have a new notification' };
    }
  }
}
