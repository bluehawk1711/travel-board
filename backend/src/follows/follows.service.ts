import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { boards, follows, users } from '../db/schema';
import { MESSAGES } from '../common/messages';
import { BoardsService } from '../boards/boards.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../auth/auth.service';

export type FollowTargetType = 'USER' | 'BOARD';

export interface FollowUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface FollowListResult<T> {
  items: T[];
  total: number;
}

export interface FollowToggleResult {
  following: boolean;
  followerCount: number;
}

@Injectable()
export class FollowsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly boardsService: BoardsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Users ─────────────────────────────────────────────────

  async followUser(
    follower: AuthUser,
    targetUserId: string,
  ): Promise<FollowToggleResult> {
    if (follower.id === targetUserId) {
      throw new BadRequestException(MESSAGES.FOLLOWS.SELF_FOLLOW);
    }
    const target = await this.requireUser(targetUserId);
    await this.insertFollow(follower.id, 'USER', target.id);
    this.notifications.notify({
      userId: target.id,
      type: 'NEW_FOLLOWER',
      actorId: follower.id,
      targetType: 'USER',
      targetId: target.id,
      metadata: { actorName: follower.name },
    });
    return {
      following: true,
      followerCount: await this.userFollowerCount(target.id),
    };
  }

  async unfollowUser(
    follower: AuthUser,
    targetUserId: string,
  ): Promise<FollowToggleResult> {
    if (follower.id === targetUserId) {
      throw new BadRequestException(MESSAGES.FOLLOWS.UNFOLLOW_SELF);
    }
    await this.db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, follower.id),
          eq(follows.targetType, 'USER'),
          eq(follows.targetId, targetUserId),
        ),
      );
    return {
      following: false,
      followerCount: await this.userFollowerCount(targetUserId),
    };
  }

  async userFollowers(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<FollowListResult<FollowUser>> {
    await this.requireUser(userId);
    return this.listFollowUsers(
      { targetType: 'USER', targetId: userId },
      limit,
      offset,
    );
  }

  async userFollowing(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<FollowListResult<FollowUser>> {
    await this.requireUser(userId);
    const { total } = await this.countFollows(
      and(eq(follows.followerId, userId), eq(follows.targetType, 'USER')),
    );
    const rows = await this.db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.targetId, users.id))
      .where(
        and(eq(follows.followerId, userId), eq(follows.targetType, 'USER')),
      )
      .orderBy(desc(follows.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0));
    return { items: rows.map((r) => this.toFollowUser(r.user)), total };
  }

  // ── Boards ────────────────────────────────────────────────

  async followBoard(
    follower: AuthUser,
    boardId: string,
  ): Promise<FollowToggleResult> {
    if (!(await this.boardsService.canView(boardId, follower.id))) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    await this.insertFollow(follower.id, 'BOARD', boardId);
    const board = await this.db.query.boards.findFirst({
      columns: { ownerId: true, title: true },
      where: eq(boards.id, boardId),
    });
    if (board && board.ownerId !== follower.id) {
      this.notifications.notify({
        userId: board.ownerId,
        type: 'NEW_BOARD_FOLLOWER',
        actorId: follower.id,
        targetType: 'BOARD',
        targetId: boardId,
        metadata: { actorName: follower.name, boardTitle: board.title },
      });
    }
    return {
      following: true,
      followerCount: await this.boardFollowerCount(boardId),
    };
  }

  async unfollowBoard(
    follower: AuthUser,
    boardId: string,
  ): Promise<FollowToggleResult> {
    await this.db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, follower.id),
          eq(follows.targetType, 'BOARD'),
          eq(follows.targetId, boardId),
        ),
      );
    return {
      following: false,
      followerCount: await this.boardFollowerCount(boardId),
    };
  }

  async boardFollowers(
    boardId: string,
    viewer: AuthUser | undefined,
    limit = 20,
    offset = 0,
  ): Promise<FollowListResult<FollowUser>> {
    if (!(await this.boardsService.canView(boardId, viewer?.id))) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    return this.listFollowUsers(
      { targetType: 'BOARD', targetId: boardId },
      limit,
      offset,
    );
  }

  async isFollowing(
    followerId: string,
    targetType: FollowTargetType,
    targetId: string,
  ): Promise<boolean> {
    const row = await this.db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, followerId),
        eq(follows.targetType, targetType),
        eq(follows.targetId, targetId),
      ),
    });
    return Boolean(row);
  }

  // ── Helpers ───────────────────────────────────────────────

  private async insertFollow(
    followerId: string,
    targetType: FollowTargetType,
    targetId: string,
  ): Promise<void> {
    try {
      await this.db
        .insert(follows)
        .values({ followerId, targetType, targetId });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        return; // already following — idempotent
      }
      throw error;
    }
  }

  private async listFollowUsers(
    where: { targetType: FollowTargetType; targetId: string },
    limit: number,
    offset: number,
  ): Promise<FollowListResult<FollowUser>> {
    const parsedLimit = Math.min(Math.max(limit, 1), 100);
    const parsedOffset = Math.max(offset, 0);

    const [rows, totalRow] = await Promise.all([
      this.db
        .select({ user: users })
        .from(follows)
        .innerJoin(users, eq(follows.followerId, users.id))
        .where(
          and(
            eq(follows.targetType, where.targetType),
            eq(follows.targetId, where.targetId),
          ),
        )
        .orderBy(desc(follows.createdAt))
        .limit(parsedLimit)
        .offset(parsedOffset),
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(follows)
        .where(
          and(
            eq(follows.targetType, where.targetType),
            eq(follows.targetId, where.targetId),
          ),
        ),
    ]);

    return {
      items: rows.map((r) => this.toFollowUser(r.user)),
      total: Number(totalRow[0]?.total ?? 0),
    };
  }

  private async countFollows(
    condition: SQL | undefined,
  ): Promise<{ total: number }> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(follows)
      .where(condition);
    return { total: Number(row?.total ?? 0) };
  }

  private async userFollowerCount(userId: string): Promise<number> {
    const { total } = await this.countFollows(
      and(eq(follows.targetType, 'USER'), eq(follows.targetId, userId)),
    );
    return total;
  }

  private async boardFollowerCount(boardId: string): Promise<number> {
    const { total } = await this.countFollows(
      and(eq(follows.targetType, 'BOARD'), eq(follows.targetId, boardId)),
    );
    return total;
  }

  private async requireUser(userId: string) {
    const user = await this.db.query.users.findFirst({
      columns: { id: true },
      where: eq(users.id, userId),
    });
    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.USER_NOT_FOUND);
    }
    return user;
  }

  private toFollowUser(user: typeof users.$inferSelect): FollowUser {
    return { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
  }
}
