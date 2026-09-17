import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Redis } from '@upstash/redis';
import type { Cache } from 'cache-manager';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { boardItems, boards, follows, users } from '../db/schema';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { CountersService } from '../counters/counters.service';

const FEED_CACHE_TTL_MS = 60_000; // 60s
const FEED_VERSION_KEY = 'v:feed:explore';
const TRENDING_POOL = 200;

export type FeedSort = 'newest' | 'trending';

export interface FeedItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: string;
  itemCount: number;
  likeCount: number;
  saveCount: number;
  owner: { id: string; name: string; avatarUrl: string | null };
  createdAt: string;
  /** Trip window (nullable) so clients can filter itineraries by date range. */
  startDate: string | null;
  endDate: string | null;
}

export interface ExploreResult {
  items: FeedItem[];
  hasMore: boolean;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly countersService: CountersService,
  ) {}

  /**
   * Cache-aside feed. The cache key embeds the feed version (`v:feed:explore`),
   * which the boards module increments on create/delete/visibility change, so
   * stale feeds miss naturally (architecture.md §5.5). Searches bypass the
   * cache — they're per-query, so caching buys nothing.
   */
  async explore(
    sort: FeedSort,
    limit: number,
    offset: number,
    q?: string,
  ): Promise<ExploreResult> {
    if (q?.trim()) {
      return this.buildFeed(sort, limit, offset, q.trim());
    }

    const version = await this.redis
      .get<string>(FEED_VERSION_KEY)
      .catch(() => null);
    const cacheKey = `feed:explore:${sort}:${limit}:${offset}:${version ?? '0'}`;

    const cached = await this.cacheManager.get<ExploreResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildFeed(sort, limit, offset);
    if (result.items.length > 0) {
      await this.cacheManager.set(cacheKey, result, FEED_CACHE_TTL_MS);
    }
    return result;
  }

  /**
   * Boards owned by the users the viewer follows (public only). Personal feed,
   * so no shared Redis cache — it's cheap and must reflect follows instantly.
   */
  async followingFeed(userId: string, limit: number, offset: number) {
    const followed = await this.db
      .select({ targetId: follows.targetId })
      .from(follows)
      .where(
        and(eq(follows.followerId, userId), eq(follows.targetType, 'USER')),
      );
    if (followed.length === 0) {
      return { items: [], hasMore: false };
    }
    const followedIds = followed.map((f) => f.targetId);
    const rows = await this.db.query.boards.findMany({
      where: and(
        eq(boards.visibility, 'PUBLIC'),
        inArray(boards.ownerId, followedIds),
      ),
      orderBy: [desc(boards.createdAt)],
      limit: limit + 1,
      offset,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: await this.decorate(page), hasMore };
  }

  private async buildFeed(
    sort: FeedSort,
    limit: number,
    offset: number,
    q?: string,
  ): Promise<ExploreResult> {
    let rows: schema.Board[];

    if (q) {
      const needle = `%${q.toLowerCase()}%`;
      rows = await this.db.query.boards.findMany({
        where: and(
          eq(boards.visibility, 'PUBLIC'),
          or(
            ilike(boards.title, needle),
            ilike(boards.destination ?? '', needle),
          ),
        ),
        orderBy: [desc(boards.createdAt)],
        limit: limit + 1,
        offset,
      });
    } else if (sort === 'trending') {
      const trendingIds =
        await this.countersService.trendingBoardIds(TRENDING_POOL);
      rows =
        trendingIds.length > 0
          ? await this.loadPublicBoardsInOrder(
              trendingIds.slice(offset, offset + limit + 1),
            )
          : await this.latestPublicBoards(limit + 1, offset);
    } else {
      rows = await this.latestPublicBoards(limit + 1, offset);
    }

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const items = await this.decorate(page);
    return { items, hasMore };
  }

  /** Keeps trending order (ZREVRANGE order) and drops any boards that turned private. */
  private async loadPublicBoardsInOrder(
    ids: string[],
  ): Promise<schema.Board[]> {
    if (ids.length === 0) {
      return [];
    }
    const found = await this.db.query.boards.findMany({
      where: inArray(boards.id, ids),
    });
    const byId = new Map(found.map((b) => [b.id, b]));
    return ids
      .map((id) => byId.get(id))
      .filter((b): b is schema.Board => Boolean(b))
      .filter((b) => b.visibility === 'PUBLIC');
  }

  private async latestPublicBoards(
    limit: number,
    offset: number,
  ): Promise<schema.Board[]> {
    return this.db.query.boards.findMany({
      where: eq(boards.visibility, 'PUBLIC'),
      orderBy: [desc(boards.createdAt)],
      limit,
      offset,
    });
  }

  private async decorate(rows: schema.Board[]): Promise<FeedItem[]> {
    if (rows.length === 0) {
      return [];
    }
    const boardIds = rows.map((b) => b.id);
    const ownerIds = [...new Set(rows.map((b) => b.ownerId))];

    const [owners, itemCounts] = await Promise.all([
      this.db.query.users.findMany({
        where: inArray(users.id, ownerIds),
      }),
      this.db
        .select({ boardId: boardItems.boardId, count: sql<number>`count(*)` })
        .from(boardItems)
        .where(inArray(boardItems.boardId, boardIds))
        .groupBy(boardItems.boardId),
    ]);

    const ownerById = new Map(owners.map((u) => [u.id, u]));
    const itemCountByBoard = new Map(
      itemCounts.map((r) => [r.boardId, Number(r.count)]),
    );

    // Batch like/save counts via Redis pipeline (M4).
    const pipeline = this.redis.pipeline();
    for (const id of boardIds) {
      pipeline.scard(`likes:board:${id}`);
      pipeline.scard(`saves:board:${id}`);
    }
    const counts = await pipeline.exec();
    const countsById = new Map<
      string,
      { likeCount: number; saveCount: number }
    >();
    for (let i = 0; i < boardIds.length; i++) {
      const likeCount = Number(counts[i * 2] ?? 0);
      const saveCount = Number(counts[i * 2 + 1] ?? 0);
      countsById.set(boardIds[i], { likeCount, saveCount });
    }

    return rows.map((board) => {
      const owner = ownerById.get(board.ownerId);
      const count = countsById.get(board.id);
      return {
        id: board.id,
        title: board.title,
        coverImageUrl: board.coverImageUrl,
        destination: board.destination,
        boardType: board.boardType,
        itemCount: itemCountByBoard.get(board.id) ?? 0,
        likeCount: count?.likeCount ?? 0,
        saveCount: count?.saveCount ?? 0,
        owner: {
          id: board.ownerId,
          name: owner?.name ?? 'Unknown',
          avatarUrl: owner?.avatarUrl ?? null,
        },
        createdAt: board.createdAt.toISOString(),
        // drizzle `date` columns serialize as 'YYYY-MM-DD' strings.
        startDate: board.startDate ?? null,
        endDate: board.endDate ?? null,
      };
    });
  }
}
