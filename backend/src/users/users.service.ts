import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { boardItems, boards, follows, users } from '../db/schema';
import { MESSAGES } from '../common/messages';
import { CountersService } from '../counters/counters.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface SearchUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  publicBoardCount: number;
  /** Set when the requester is signed in and not viewing themselves. */
  isFollowing: boolean | null;
  isMe: boolean;
}

export interface UserBoardFeedItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: string;
  itemCount: number;
  likeCount: number;
  saveCount: number;
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly countersService: CountersService,
  ) {}

  /**
   * Per-user preferences (1:1 with `users`). Lazily created on first read —
   * avoids a backfill migration and a write on every signup path.
   */
  async getSettings(userId: string): Promise<schema.UserSettingsRow> {
    const existing = await this.db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
    });
    if (existing) return existing;

    const [created] = await this.db
      .insert(schema.userSettings)
      .values({ userId })
      .onConflictDoNothing()
      .returning();

    // Lost an insert race — re-read the winner's row.
    if (!created) {
      const winner = await this.db.query.userSettings.findFirst({
        where: eq(schema.userSettings.userId, userId),
      });
      if (!winner) throw new NotFoundException(MESSAGES.SETTINGS.NOT_FOUND);
      return winner;
    }
    return created;
  }

  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<schema.UserSettingsRow> {
    // Ensure the row exists before updating.
    await this.getSettings(userId);

    const [updated] = await this.db
      .update(schema.userSettings)
      .set({
        ...(dto.themeMode !== undefined ? { themeMode: dto.themeMode } : {}),
        ...(dto.notificationsEnabled !== undefined
          ? { notificationsEnabled: dto.notificationsEnabled }
          : {}),
        ...(dto.emailUpdates !== undefined
          ? { emailUpdates: dto.emailUpdates }
          : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.userSettings.userId, userId))
      .returning();

    if (!updated) throw new NotFoundException(MESSAGES.SETTINGS.NOT_FOUND);
    return updated;
  }

  /** Used by the chat UI to find someone to start a DM with. */
  async search(query: string): Promise<{ users: SearchUser[] }> {
    const q = query.trim();
    if (!q) {
      return { users: [] };
    }
    const rows = await this.db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(ilike(users.name, `%${q}%`))
      .limit(10);
    return { users: rows };
  }

  async profile(userId: string, viewerId?: string): Promise<PublicProfile> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.USER_NOT_FOUND);
    }

    const [followerRow, followingRow, boardRow, followingSelf] =
      await Promise.all([
        this.db
          .select({ total: count() })
          .from(follows)
          .where(
            and(eq(follows.targetType, 'USER'), eq(follows.targetId, userId)),
          ),
        this.db
          .select({ total: count() })
          .from(follows)
          .where(
            and(eq(follows.followerId, userId), eq(follows.targetType, 'USER')),
          ),
        this.db
          .select({ total: sql<number>`count(*)` })
          .from(boards)
          .where(
            and(eq(boards.ownerId, userId), eq(boards.visibility, 'PUBLIC')),
          ),
        viewerId && viewerId !== userId
          ? this.db.query.follows.findFirst({
              columns: { followerId: true },
              where: and(
                eq(follows.followerId, viewerId),
                eq(follows.targetType, 'USER'),
                eq(follows.targetId, userId),
              ),
            })
          : Promise.resolve(null),
      ]);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      followerCount: Number(followerRow[0]?.total ?? 0),
      followingCount: Number(followingRow[0]?.total ?? 0),
      publicBoardCount: Number(boardRow[0]?.total ?? 0),
      isFollowing: followingSelf ? true : null,
      isMe: viewerId === userId,
    };
  }

  /** Public boards owned by a user, decorated with counts (profile grid). */
  async userBoards(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: UserBoardFeedItem[]; hasMore: boolean }> {
    const rows = await this.db.query.boards.findMany({
      where: and(eq(boards.ownerId, userId), eq(boards.visibility, 'PUBLIC')),
      orderBy: [desc(boards.createdAt)],
      limit: limit + 1,
      offset,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    if (page.length === 0) {
      return { items: [], hasMore };
    }

    const boardIds = page.map((b) => b.id);
    const [itemCountRows, counts] = await Promise.all([
      this.db
        .select({ boardId: boardItems.boardId, count: sql<number>`count(*)` })
        .from(boardItems)
        .where(inArray(boardItems.boardId, boardIds))
        .groupBy(boardItems.boardId),
      Promise.all(
        boardIds.map(async (id) => ({
          id,
          likeCount: await this.countersService.likeCount(id),
          saveCount: await this.countersService.saveCount(id),
        })),
      ),
    ]);
    const itemCountByBoard = new Map(
      itemCountRows.map((r) => [r.boardId, Number(r.count)]),
    );
    const countsById = new Map(counts.map((c) => [c.id, c]));

    return {
      hasMore,
      items: page.map((b) => ({
        id: b.id,
        title: b.title,
        coverImageUrl: b.coverImageUrl,
        destination: b.destination,
        boardType: b.boardType,
        itemCount: itemCountByBoard.get(b.id) ?? 0,
        likeCount: countsById.get(b.id)?.likeCount ?? 0,
        saveCount: countsById.get(b.id)?.saveCount ?? 0,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { name, bio, avatarUrl } = dto;
    const [updated] = await this.db
      .update(users)
      .set({
        name,
        // An empty string means "clear the bio" — store NULL, not ''.
        // `undefined` keeps Drizzle's skip-undefined behavior for partials.
        bio: bio === undefined ? undefined : bio === '' ? null : bio,
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
      });
    return { user: updated };
  }
}
