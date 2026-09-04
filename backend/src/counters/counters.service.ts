import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Redis } from '@upstash/redis';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { boardSaves, likes } from '../db/schema';
import { REDIS_CLIENT } from '../common/redis/redis.constants';

const likesKey = (boardId: string) => `likes:board:${boardId}`;
const savesKey = (boardId: string) => `saves:board:${boardId}`;
const dirtyKey = 'counters:dirty';
const trendingKey = 'trending:boards';

/**
 * Hot like/save counters (architecture.md §5.6).
 *
 * Postgres rows (likes / board_saves) are the durable source of truth and are
 * written through on every toggle. Redis holds membership sets for O(1) reads
 * (SCARD = count, SISMEMBER = "did I like?") plus the trending scoreboard.
 * The scheduled job reconciles Redis from Postgres so a Redis eviction can
 * never permanently corrupt a counter.
 */
@Injectable()
export class CountersService {
  private readonly logger = new Logger(CountersService.name);

  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Likes ─────────────────────────────────────────────────

  async toggleLike(
    boardId: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const existing = await this.db.query.likes.findFirst({
      where: and(eq(likes.boardId, boardId), eq(likes.userId, userId)),
    });

    if (existing) {
      await this.db
        .delete(likes)
        .where(and(eq(likes.boardId, boardId), eq(likes.userId, userId)));
      await this.redis.srem(likesKey(boardId), userId);
      await this.redis.zincrby(trendingKey, -1, boardId);
    } else {
      await this.db.insert(likes).values({ boardId, userId });
      await this.redis.sadd(likesKey(boardId), userId);
      await this.redis.zincrby(trendingKey, 1, boardId);
    }
    await this.markDirty(boardId);
    return { liked: !existing, likeCount: await this.likeCount(boardId) };
  }

  /** Redis SCARD with a Postgres fallback when Redis is unreachable. */
  async likeCount(boardId: string): Promise<number> {
    try {
      return await this.redis.scard(likesKey(boardId));
    } catch {
      return this.dbCount(likes, boardId);
    }
  }

  async didUserLike(boardId: string, userId: string): Promise<boolean> {
    try {
      return (await this.redis.sismember(likesKey(boardId), userId)) === 1;
    } catch {
      const row = await this.db.query.likes.findFirst({
        where: and(eq(likes.boardId, boardId), eq(likes.userId, userId)),
      });
      return Boolean(row);
    }
  }

  // ── Saves ─────────────────────────────────────────────────

  async toggleSave(
    boardId: string,
    userId: string,
  ): Promise<{ saved: boolean; saveCount: number }> {
    const existing = await this.db.query.boardSaves.findFirst({
      where: and(
        eq(boardSaves.boardId, boardId),
        eq(boardSaves.userId, userId),
      ),
    });

    if (existing) {
      await this.db
        .delete(boardSaves)
        .where(
          and(eq(boardSaves.boardId, boardId), eq(boardSaves.userId, userId)),
        );
      await this.redis.srem(savesKey(boardId), userId);
    } else {
      await this.db.insert(boardSaves).values({ boardId, userId });
      await this.redis.sadd(savesKey(boardId), userId);
    }
    await this.markDirty(boardId);
    return { saved: !existing, saveCount: await this.saveCount(boardId) };
  }

  async saveCount(boardId: string): Promise<number> {
    try {
      return await this.redis.scard(savesKey(boardId));
    } catch {
      return this.dbCount(boardSaves, boardId);
    }
  }

  // ── Trending (Redis sorted set) ───────────────────────────

  async trendingBoardIds(limit = 20): Promise<string[]> {
    try {
      const ids = await this.redis.zrange(trendingKey, 0, limit - 1, {
        rev: true,
      });
      return ids as string[];
    } catch {
      return [];
    }
  }

  // ── Scheduled reconcile (architecture.md §5.6) ────────────

  /**
   * Rebuilds Redis membership sets from Postgres for boards mutated since the
   * last run. Redis lock ensures a single flusher when the API is scaled out.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileCounters(): Promise<void> {
    let locked: unknown;
    try {
      locked = await this.redis.set('lock:cron:counters-reconcile', '1', {
        nx: true,
        ex: 240,
      });
    } catch {
      return; // Redis down — skip this run, write-through keeps Postgres correct
    }
    if (!locked) {
      return; // another instance is already reconciling
    }

    try {
      const dirty = await this.redis.smembers(dirtyKey);
      for (const boardId of dirty) {
        await this.rebuildForBoard(likes, likesKey(boardId), boardId);
        await this.rebuildForBoard(boardSaves, savesKey(boardId), boardId);
        await this.redis.srem(dirtyKey, boardId);
      }
      if (dirty.length > 0) {
        this.logger.log(`Reconciled counters for ${dirty.length} board(s)`);
      }
    } finally {
      await this.redis.del('lock:cron:counters-reconcile');
    }
  }

  private async rebuildForBoard(
    table: typeof likes | typeof boardSaves,
    key: string,
    boardId: string,
  ): Promise<void> {
    const rows = await this.db
      .select({ userId: table.userId })
      .from(table)
      .where(eq(table.boardId, boardId));
    await this.redis.del(key);
    const userIds = rows.map((r) => r.userId);
    if (userIds.length > 0) {
      await this.redis.sadd(key, userIds[0], ...userIds.slice(1));
    }
  }

  private async markDirty(boardId: string): Promise<void> {
    await this.redis.sadd(dirtyKey, boardId);
  }

  private async dbCount(
    table: typeof likes | typeof boardSaves,
    boardId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.boardId, boardId));
    return Number(row?.count ?? 0);
  }
}
