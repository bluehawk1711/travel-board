# Travel Board App — Architecture

**Status:** Draft · **Last updated:** 2026-09-04
**Related docs:** [plan.md](./plan.md) (plan & features) · [features.md](./features.md) (MoSCoW priorities)

---

## 1. Overview

A Pinterest-style social travel board platform: users create visual, shareable trip boards
(day-by-day itineraries or freeform collections), discover other people's boards, save items
into their own boards, and collaborate with roles. Three clients — web, mobile, and (later)
third-party — talk only to a single NestJS API, which owns all business logic.

**Guiding principles:**

1. **Single backend, thin clients.** Web and mobile never touch Postgres or Redis directly.
2. **Postgres is the source of truth** (Neon). Upstash Redis is a disposable acceleration
   layer — losing it must never corrupt data.
3. **External API calls are treated as money.** Anything billed (Google Places, AI generation)
   is cached aggressively.
4. **Private data is never cached for anonymous users.**

---

## 2. System Diagram

```
                        ┌──────────────────────────────────────────────┐
                        │                External services             │
                        │  Google OAuth · Google Places · R2/S3 · AI   │
                        └───────────────────┬──────────────────────────┘
                                            │
        ┌──────────────┐      HTTPS        ▼      HTTPS        ┌──────────────┐
        │  Next.js web │ ───────────────── NestJS API ────────────────── │ Expo mobile │
        │  (Vercel)    │                    (Render/Railway)             │ (App Store) │
        └──────────────┘                         │   │                   └──────────────┘
                                                 │   │
                          ┌──────────────────────┘   └──────────────────────┐
                          ▼                                                  ▼
              ┌──────────────────────┐                        ┌──────────────────────┐
              │  PostgreSQL (Neon)   │                        │  Upstash Redis       │
              │  source of truth     │                        │  cache · throttler   │
              │  Drizzle ORM         │                        │  counters · trending │
              └──────────────────────┘                        └──────────────────────┘
```

- **Postgres (Neon):** all durable state — users, boards, items, follows, likes, comments.
- **Upstash Redis:** read-accelerating cache, distributed rate limiting, hot counters,
  trending scores, and short-lived temp data (rate-limit state, AI draft sessions).
- **Web & Mobile:** thin API clients. Auth state managed client-side (JWT); server data
  fetched through the API.

---

## 3. Tech Stack per Layer

| Layer | Technology | Versions (current) |
|---|---|---|
| Web | Next.js (App Router) + TypeScript + Tailwind 4 | next 16.3.4 |
| Mobile | React Native + Expo + Expo Router + NativeWind | expo ~57, RN 0.86 |
| API | NestJS + Express | @nestjs/core ^11 |
| Database | PostgreSQL on Neon | — |
| ORM | Drizzle (node-postgres driver) | drizzle-orm ^0.45 |
| Cache / Redis | Upstash Redis (`@upstash/redis`) | latest |
| API caching | `@nestjs/cache-manager` (Keyv) + in-memory L1 | ^12 / cache-manager ^7 |
| Rate limiting | `@nestjs/throttler` + custom Upstash storage | ^6.5 |
| Auth | Passport (JWT strategy) + Google OAuth | passport ^0.7 |
| Realtime | `@nestjs/websockets` + socket.io | ^11 |
| Jobs | `@nestjs/schedule` (cron: counter flush, cleanup) | ^12 |
| Image storage | Cloudflare R2 (S3-compatible) | — |
| Search | Postgres full-text → Meilisearch (later) | — |

---

## 4. Backend (NestJS) Architecture

### 4.1 Module Map (target)

```
src/
├── main.ts                     # bootstrap: helmet, compression, CORS, global pipes
├── app.module.ts               # root: ConfigModule, CacheModule (tiered), ThrottlerModule
├── config/                     # typed env config (Joi or class-validator schema)
├── db/
│   ├── dbProvider.ts           # Drizzle provider (PG_CONNECTION token)
│   ├── schema.ts               # Drizzle schema (all tables)
│   └── drizzle/                # generated migrations
├── common/
│   ├── cache/                  # cache keys, Keyv/Upstash store, cache helpers
│   ├── redis/                  # RedisModule (@upstash/redis provider), throttler storage
│   ├── decorators/ guards/ interceptors/ pipes/ filters/ dto/
├── modules/
│   ├── auth/                   # email+password, Google OAuth, JWT issuance
│   ├── users/                  # profile CRUD, public profiles
│   ├── boards/                 # boards, sections, items, cover images, permissions
│   ├── discovery/              # explore feed, search, trending
│   ├── social/                 # likes, saves, follows, comments
│   ├── collaboration/          # invites, roles, activity log, (later) websocket sync
│   ├── places/                 # Google Places proxy + cache + manual places
│   ├── ai/                     # "Build my trip" generator + cached drafts
│   └── billing/                # (later) premium tier
```

### 4.2 Request Lifecycle

```
Client → Guards (auth, throttler) → Pipes (validation/DTO) → Interceptors
      → Controller → Service (cache-aside: Redis → Postgres) → Response
                       │
                       └─ write path: Postgres first, then invalidate/update cache keys
```

- **Read path:** service checks L1/L2 cache; on miss, queries Postgres, populates cache with
  TTL. (`CacheInterceptor` optional for cheap GET endpoints; explicit cache-aside preferred
  where invalidation matters.)
- **Write path:** mutate Postgres first (source of truth), then invalidate affected cache
  keys / bump version keys. Never write-through to Redis as the source.

### 4.3 Database Access

- Drizzle via `node-postgres` `Pool` (see `backend/src/db/dbProvider.ts`).
- Migrations with `drizzle-kit`; schema in `backend/src/db/schema.ts`.
- **Cache invalidation triggers live in the same service transaction as the write** so they
  can never be forgotten (e.g. `boardsService.update()` deletes `board:{id}`).

### 4.4 Realtime (Socket.IO)

Two gateways share the single Socket.IO server mounted on the NestJS HTTP server
(see plan.md §4.5):

- **`ChatGateway`** (`chat/`) — `conv:{conversationId}` rooms, presence keys, flood guard.
- **`BoardsGateway`** (`boards/`) — `board:{boardId}` rooms for co-editing: `board:join` /
  `board:leave` (permission-checked against the service layer), `board:presence` from the
  `board:{id}:active` Redis set, and `board:change` broadcasts emitted by the REST write
  endpoints after the DB write (Postgres stays the source of truth; sockets are the
  notification layer).

Both register the same JWT handshake middleware (`common/ws/jwt-socket-auth.ts`) so socket
and REST auth are enforced identically regardless of which gateway a client connects to.

---

## 5. Caching Architecture (Upstash Redis)

### 5.1 Provider Choice

- **Upstash Redis** is the only Redis in the stack: REST-based, serverless-friendly, TTL
  native, global replication, generous free tier.
- Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

### 5.2 Tiered Cache (L1 → L2)

cache-manager v7 uses **Keyv** under the hood, so `CacheModule.registerAsync` is configured
with multiple stores:

| Tier | Store | Lifetime | Purpose |
|---|---|---|---|
| L1 | `KeyvCacheableMemory` (ttl ~60s, lruSize ~5000) | per API instance | fastest reads, absorbs hot requests |
| L2 | Upstash Redis (Keyv store adapter) | shared | distributed cache, survives restarts |
| L3 | Postgres | permanent | source of truth |

First store in the `stores` array is the default; the rest are fallbacks on miss.

**Two implementation options for the L2 Keyv store:**

1. **`keyv-upstash`** (npm) — plug-and-play Keyv adapter for Upstash.
   ⚠️ Last published ~2 years ago, near-zero adoption → treat as risky for production.
2. **Custom Keyv store over `@upstash/redis`** *(recommended)* — ~50-line class implementing
   the Keyv store interface (`get`, `set`, `delete`, `clear`, `has`, iterator) delegating to
   the official, actively-maintained client. Example shape:

```ts
// src/common/cache/upstash-keyv.store.ts
import { Redis } from '@upstash/redis';
import { KeyvStoreAdapter } from 'keyv'; // structural interface

export class UpstashKeyvStore implements KeyvStoreAdapter {
  constructor(
    private readonly redis: Redis,
    private readonly namespace = 'cache',
  ) {}
  private k(key: string) { return `${this.namespace}::${key}`; }
  async get(key: string)  { return this.redis.get(this.k(key)); }
  async set(key: string, value: unknown, ttl?: number) {
    if (ttl) await this.redis.set(this.k(key), value, { ex: Math.round(ttl / 1000) });
    else     await this.redis.set(this.k(key), value);
  }
  async delete(key: string) { return this.redis.del(this.k(key)); }
  async clear() { /* SCAN + batch UNLINK within namespace */ }
  async has(key: string) { return this.redis.exists(this.k(key)); }
  // iterator(): scan + return [key, value] pairs
}
```

> Construct the `@upstash/redis` client with `automaticDeserialization: false` when used as a
> Keyv store, so Keyv's own serialization owns the value format.

### 5.3 Cache Key Naming

Namespaced, hierarchical: `{domain}:{resource}:{id}:{field?}`

| Pattern | Example |
|---|---|
| Feed | `feed:explore:newest`, `feed:following:u42` |
| Board | `board:123`, `board:123:items` |
| Profile | `user:7:profile` |
| Places | `places:text:tokyo+coffee` |
| Counters | `counters:board:123:likes`, `counters:board:123:saves` |
| Trending | `trending:boards` (sorted set) |
| AI drafts | `ai:trip:abc123` |
| Throttle | `throttle:{hash}:{ttlWindow}` |
| Version | `v:board:123` (invalidation bump key) |

### 5.4 Caching Policy (TTL table)

| Data | Key | TTL | Invalidation |
|---|---|---|---|
| Explore feed (anon) | `feed:explore:{sort}` | 60s | new public board / edit |
| Board detail (public) | `board:{id}` | 60s | edit, visibility change |
| Board items | `board:{id}:items` | 60s | item add/remove/reorder |
| Google Places response | `places:*` | 24h | none (immutable) — **cuts Places API spend** |
| Public profile | `user:{id}:profile` | 5m | profile edit |
| AI trip draft | `ai:trip:{id}` | 1h | regeneration |
| Trending | `trending:boards` | 5m | ZINCRBY on like/save |
| Like/save counters | `counters:*` | none (persistent-ish) | INCR/DECR; flushed to Postgres |
| Search results | `search:{query}:{page}` | 5m | none for MVP |

**Rule of thumb:** the hotter and more expensive the query, the longer the TTL; anything
user-scoped or private is either not cached or cached per-user with a short TTL.

### 5.5 Invalidation Strategy

MVP: **TTL-only** — simple, no event plumbing, worst case the feed is 60s stale.

Later (post-MVP, before realtime): **event-driven invalidation** —

- Write path deletes the exact keys it affects (`del board:{id}` in the same service call).
- For collections (feeds/search), keep a per-resource **version key** (`v:board:123`); feed
  cache keys embed the version: `feed:explore:{v:board:123}`. On any write, `INCR v:board:123`
  and stale feeds naturally miss.
- Same pattern for user-scoped collections (`v:user:7`).

### 5.6 Hot Counters (likes / saves) — write-behind

Likes and saves are high-frequency, low-fidelity writes. Redis owns the live value:

```
POST /boards/:id/like  →  SADD likes:board:{id} {userId}  +  ZINCRBY trending:boards 1
GET  /boards/:id       →  read SCARD likes:board:{id} (fallback: Postgres counter column)
```

- **Flush to Postgres:** `@nestjs/schedule` cron every N minutes snapshots dirty counters
  (`counters:*` keys) into Postgres. On flush, decrement a dirty flag so partial failures can
  retry; a full Postgres recount remains the ultimate recovery path.
- Keeps like/save taps off Postgres write load while staying correct under crash.

### 5.7 Trending (sorted sets)

`ZINCRBY trending:boards 1 {boardId}` on like/save/comment; `ZRANGE` top-N for the trending
tab; TTL 5m window or decay factor on read. Fully disposable — rebuilt from Postgres on cache
loss.

### 5.8 Distributed Rate Limiting (throttler + Upstash)

Keep `@nestjs/throttler` for its guard/decorator ergonomics; replace the default in-memory
`ThrottlerStorage` with a custom one backed by `@upstash/redis`:

```ts
// src/common/redis/throttler-upstash.storage.ts
export class ThrottlerStorageUpstash implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}
  async increment(key: string, ttlMs: number): Promise<ThrottlerStorageRecord> {
    const k = `throttle:${key}`;
    const totalHits = await this.redis.incr(k);
    if (totalHits === 1) await this.redis.expire(k, Math.ceil(ttlMs / 1000));
    return { totalHits, timeToExpire: await this.redis.ttl(k) };
  }
}
```

- Distributed across API instances; survives restarts.
- Per-route `@Throttle()` overrides: tighter on `/auth/*`, `/ai/*`, and the Places proxy.

---

## 6. External Services

| Service | Use | Integration notes |
|---|---|---|
| Google OAuth | login | OAuth2 code flow; link to email/password accounts |
| Google Places API | place search / details / photos | **server-side only**; response cached in Redis 24h; API key never exposed to clients |
| Cloudflare R2 | board cover + item images | S3-compatible SDK; presigned upload URLs; AV scanning later |
| AI provider (OpenAI/Anthropic) | "Build my trip" drafts | server-side; results cached (`ai:trip:*`) so re-edits don't re-bill |

---

## 7. Web (Next.js) Architecture

- **App Router, client components for interactive surfaces** (feed, board editor, save flow).
- **Data fetching:** fetch from the NestJS API (`API_URL` env), not from Postgres.
- **Server components** for public/SEO surfaces (board detail, profile) with `fetch`
  revalidation aligned to API TTLs.
- **Auth:** JWT in httpOnly cookie (set by API or web); API validates via Passport JWT.
- **Ads (later):** AdSense only on explore/feed and board detail — never the editor.
- **Caching at the edge (later):** Vercel CDN / ISR for public board pages.

## 8. Mobile (Expo) Architecture

- **Expo Router** file-based navigation; typed routes + React Compiler enabled.
- **State:** TanStack Query for server state (with AsyncStorage persistence for offline-ish
  UX); Zustand for lightweight client state (draft editor, save-flow picker).
- **Caching client-side:** TanStack Query `staleTime` aligned to API TTLs; boards cache is
  invalidated on mutation via query keys (`['board', id]`).
- **Maps:** `react-native-maps`; places search via the API (never direct Google calls).
- **Push notifications (later):** expo-notifications → Expo push service → API stores tokens.
- **Ads (later):** AdMob via Expo, only if ads ship on mobile before Premium.

---

## 9. Deployment Topology

| Piece | Host | Notes |
|---|---|---|
| Web | Vercel | static + serverless; `API_URL` → API host |
| API | Render or Railway (long-running Node) | multiple instances supported (Redis makes throttling/cache shared) |
| Postgres | Neon | pooled connections; `DATABASE_URL` on API only |
| Redis | Upstash | region near API host; env vars on API only |
| Images | Cloudflare R2 | presigned uploads; CDN through R2 public bucket or Cloudflare CDN |
| Jobs | `@nestjs/schedule` inside API | counter flush, cache cleanup (single instance must own cron → guard with Redis lock if >1 instance) |

> **Cron-on-multiple-instances caveat:** with >1 API instance, schedule jobs must take a Redis
> distributed lock (`SET lock:cron:{name} NX EX`) so only one instance flushes counters.

---

## 10. Security

- **Secrets** (DATABASE_URL, UPSTASH_*, Google keys, R2 keys, AI keys) live only in the API's
  env — never in web/mobile bundles.
- **CORS** restricted to web origin; mobile sends `Authorization` header (no CORS).
- **helmet + compression** already wired in `main.ts`; CSRF for cookie-based web auth.
- **Private boards:** membership/permission check server-side (owner/editor/viewer); cache
  layer must not serve private boards to non-members (cache key includes viewer only when
  authorized, or skip caching for private boards).
- **Rate limits:** tighter on auth (brute force) and Places/AI (cost).

---

## 11. Consistency & Failure Modes

| Scenario | Behavior |
|---|---|
| Redis down | Reads degrade to Postgres (cache-aside miss path); throttling falls back to in-memory storage; counters keep last-known Postgres value. No data loss — Redis is disposable. |
| Redis evicts data | Same as cache miss; TTLs keep everything self-healing. |
| Counter flush partially fails | Dirty-flag retry; worst case a recount from `likes`/`saves` tables. |
| Board edited while cached | TTL ≤ 60s bounds staleness for MVP; event-driven invalidation later. |
| Two instances run the cron | Redis lock ensures a single flusher. |

---

## 12. Open Decisions

Tracked alongside [plan.md → Open Decisions](./plan.md).

1. **L2 Keyv store:** `keyv-upstash` (fast, unmaintained) vs. custom adapter (recommended).
2. **Invalidation:** TTL-only (MVP) vs. version-key event-driven invalidation (later).
3. **Upstash region:** choose nearest to API host; single region until global read replicas
   are needed.
4. **Realtime collaboration:** polling → socket.io (already in deps) when needed.
5. **Search:** Postgres FTS → Meilisearch at scale.
6. **Counter flush cadence:** cron interval tuned to like/save volume (start 1–5 min).