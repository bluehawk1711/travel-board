import type { Redis } from '@upstash/redis';

interface SetEntry {
  key: string;
  value: unknown;
  ttl?: number;
}

/**
 * Keyv-compatible store adapter backed by Upstash Redis (HTTP/REST).
 *
 * Plugs into `@nestjs/cache-manager` (cache-manager v7) as the shared L2 store
 * in a tiered setup: in-memory L1 -> Upstash L2 -> Postgres L3. cache-manager
 * treats each entry in `stores` as a serialization-less store, so this adapter
 * owns JSON (de)serialization itself.
 *
 * The Upstash client is constructed with `automaticDeserialization: false` so
 * we get the raw stored strings back and parse them ourselves.
 *
 * Keys are namespaced under `cache::` so cached data can never collide with
 * counters / throttler keys on the same database.
 */
export class UpstashKeyvStore {
  readonly opts: Record<string, never> = {};
  namespace?: string;

  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'cache',
  ) {
    this.namespace = prefix;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    const k = this.k(key);
    const serialized = value === undefined ? null : JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await this.redis.set(k, serialized, {
        ex: Math.max(1, Math.round(ttlMs / 1000)),
      });
    } else {
      await this.redis.set(k, serialized);
    }
    return true;
  }

  async setMany(entries: SetEntry[]): Promise<void> {
    // Pipeline mset for atomicity, then set TTLs in a second pipeline.
    const setPipeline = this.redis.pipeline();
    for (const e of entries) {
      setPipeline.set(this.k(e.key), JSON.stringify(e.value ?? null));
    }
    await setPipeline.exec();

    const ttlPipeline = this.redis.pipeline();
    let hasTtl = false;
    for (const e of entries) {
      if (e.ttl && e.ttl > 0) {
        hasTtl = true;
        ttlPipeline.expire(
          this.k(e.key),
          Math.max(1, Math.round(e.ttl / 1000)),
        );
      }
    }
    if (hasTtl) {
      await ttlPipeline.exec();
    }
  }
  async get<Value>(key: string): Promise<Value | undefined> {
    const raw = await this.redis.get<string>(this.k(key));
    if (raw === null || raw === undefined) {
      return undefined;
    }
    return JSON.parse(raw) as Value;
  }

  async getMany<Value>(keys: string[]): Promise<Array<Value | undefined>> {
    const prefixed = keys.map((k) => this.k(k));
    const raws = (await this.redis.mget(...prefixed)) as unknown as Array<
      string | null
    >;
    return raws.map((raw) =>
      raw === null || raw === undefined
        ? undefined
        : (JSON.parse(raw) as Value),
    );
  }

  async delete(key: string): Promise<boolean> {
    return (await this.redis.del(this.k(key))) > 0;
  }

  async deleteMany(keys: string[]): Promise<boolean> {
    const prefixed = keys.map((k) => this.k(k));
    return (await this.redis.del(...prefixed)) > 0;
  }

  async has(key: string): Promise<boolean> {
    return (await this.redis.exists(this.k(key))) === 1;
  }

  /** SCAN + batch UNLINK within the namespace only. */
  async clear(): Promise<void> {
    let cursor = 0;
    const pattern = `${this.prefix}::*`;
    const MAX_ITERATIONS = 100;
    let iterations = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, {
        match: pattern,
        count: 200,
      });
      cursor = Number(next) || 0;
      if (keys.length > 0) {
        await this.redis.unlink(...keys);
      }
      iterations++;
      if (iterations >= MAX_ITERATIONS) break;
    } while (cursor !== 0);
  }

  /** Minimal no-op event-emitter surface required by the Keyv adapter contract. */
  on(event: string, listener: (...args: unknown[]) => void): this {
    void event;
    void listener;
    return this;
  }

  private k(key: string): string {
    return `${this.prefix}::${key}`;
  }
}
