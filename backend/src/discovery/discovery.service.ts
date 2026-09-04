import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Redis } from '@upstash/redis';
import type { Cache } from 'cache-manager';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { boardItems, boards, users } from '../db/schema';
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
   * stale feeds miss naturally (architecture.md §5.5).
   */
  async explore(
    sort: FeedSort,
    limit: number,
    offset: number,
  ): Promise<ExploreResult> {
    const version = await this.redis
      .get<string>(FEED_VERSION_KEY)
      .catch(() => null);
    const cacheKey = `feed:explore:${sort}:${limit}:${offset}:${version ?? '0'}`;

    const cached = await this.cacheManager.get<ExploreResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildFeed(sort, limit, offset);
    await this.cacheManager.set(cacheKey, result, FEED_CACHE_TTL_MS);
    return result;
  }

  private async buildFeed(
    sort: FeedSort,
    limit: number,
    offset: number,
  ): Promise<ExploreResult> {
    let rows: schema.Board[];

    if (sort === 'trending') {
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

    const likesAndSaves = await Promise.all(
      boardIds.map(async (id) => ({
        id,
        likeCount: await this.countersService.likeCount(id),
        saveCount: await this.countersService.saveCount(id),
      })),
    );
    const countsById = new Map(likesAndSaves.map((c) => [c.id, c]));

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
      };
    });
  }
}
