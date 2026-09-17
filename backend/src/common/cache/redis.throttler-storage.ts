import type { Redis } from '@upstash/redis';
import type { ThrottlerStorage } from '@nestjs/throttler';

/** Shape returned by ThrottlerStorage#increment (not re-exported by @nestjs/throttler v6). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Distributed `ThrottlerStorage` backed by Upstash Redis.
 *
 * Replaces @nestjs/throttler's in-memory storage so rate-limit state survives
 * restarts and is shared across API instances. Key layout per request key:
 *   throttle:{key}           — rolling window counter (TTL = ttl)
 *   throttle:{key}:block     — block marker (TTL = blockDuration)
 *
 * Mirrors the semantics of the reference in-memory ThrottlerStorageService:
 * blocked requests are reported (and not counted), and once a counter exceeds
 * the limit the key is blocked and the counter reset so a fresh window starts
 * after the block expires.
 */
export class ThrottlerStorageUpstash implements ThrottlerStorage {
  /** Last-resort in-memory counters used while Redis is unreachable. */
  private readonly fallback = new Map<
    string,
    { totalHits: number; expiresAt: number; blockExpiresAt: number }
  >();

  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await this.incrementRedis(key, ttl, limit, blockDuration);
    } catch {
      // Redis down → degrade to per-instance in-memory limiting instead of 500s.
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }
  }

  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `throttle:${key}`;
    const blockKey = `${counterKey}:block`;

    // Already blocked → report without counting the request.
    const blockTtlSeconds = await this.redis.ttl(blockKey);
    if (blockTtlSeconds > 0) {
      return {
        totalHits: 0,
        timeToExpire: blockTtlSeconds,
        isBlocked: true,
        timeToBlockExpire: blockTtlSeconds,
      };
    }

    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const totalHits = await this.redis.incr(counterKey);
    await this.redis.expire(counterKey, ttlSeconds);
    const timeToExpire = await this.redis.ttl(counterKey);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit && blockDuration > 0) {
      const blockSeconds = Math.max(1, Math.ceil(blockDuration / 1000));
      await this.redis.set(blockKey, 1, { ex: blockSeconds });
      // Reset the counter so the window starts fresh once unblocked.
      await this.redis.del(counterKey);
      isBlocked = true;
      timeToBlockExpire = blockSeconds;
    }

    return {
      totalHits,
      timeToExpire: Math.max(timeToExpire, 0),
      isBlocked,
      timeToBlockExpire,
    };
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    let record = this.fallback.get(key);
    if (!record || record.expiresAt <= now) {
      record = { totalHits: 0, expiresAt: now + ttl, blockExpiresAt: 0 };
      this.fallback.set(key, record);
    }

    if (record.blockExpiresAt > now) {
      return {
        totalHits: 0,
        timeToExpire: Math.max(0, Math.ceil((record.expiresAt - now) / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.max(
          0,
          Math.ceil((record.blockExpiresAt - now) / 1000),
        ),
      };
    }

    record.totalHits += 1;
    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (record.totalHits > limit && blockDuration > 0) {
      record.blockExpiresAt = now + blockDuration;
      record.totalHits = 0;
      record.expiresAt = now + ttl;
      isBlocked = true;
      timeToBlockExpire = Math.max(0, Math.ceil(blockDuration / 1000));
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.max(0, Math.ceil((record.expiresAt - now) / 1000)),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
