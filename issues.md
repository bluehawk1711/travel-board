# Travel Board — Audit Findings & Upstash Redis Documentation

> Generated: 2026-09-14
> Scope: Backend (NestJS), Web (Next.js 16), Upstash Redis integration

---

## Table of Contents

1. [Upstash Redis Usage Documentation](#1-upstash-redis-usage-documentation)
2. [Critical Findings (P0)](#2-critical-findings-p0)
3. [High Findings (P1)](#3-high-findings-p1)
4. [Medium Findings (P2)](#4-medium-findings-p2)
5. [Low Findings (P3)](#5-low-findings-p3)
6. [Fixed / Resolved](#6-fixed--resolved)

---

## 1. Upstash Redis Usage Documentation

### Is Upstash Redis used?

**Yes.** Upstash Redis (`@upstash/redis` ^1.38.3) is the primary distributed state layer. It is confirmed in `backend/package.json:34` and used throughout the backend.

### Packages

| Package | Version | Purpose |
|---|---|---|
| `@upstash/redis` | ^1.38.3 | HTTP-based Redis client (serverless-friendly) |
| `@nestjs/cache-manager` | ^12.0.0 | Tiered cache orchestration (L1 in-memory + L2 Upstash) |
| `cache-manager` | ^7.2.9 | Cache manager core |
| `cacheable` | ^2.5.0 | KeyvCacheableMemory (L1 in-memory store) |
| `keyv` | ^5.6.0 | Keyv interface contract for store adapters |
| `@nestjs/throttler` | ^6.5.0 | Rate limiting with Upstash-backed storage |

### Architecture

```
Client Request → ThrottlerGuard (Upstash-backed rate limiting)
                → CacheManager (tiered: L1 in-memory → L2 Upstash Keyv → Postgres L3)
                → Service Layer (Postgres = source of truth)
                → Redis counters (likes/saves/trending/presence)
```

### Upstash Key Files

| File | Purpose |
|---|---|
| `backend/src/common/redis/redis.module.ts` | Global `REDIS_CLIENT` provider — single Upstash instance injected everywhere |
| `backend/src/common/redis/redis.constants.ts` | `REDIS_CLIENT` injection token |
| `backend/src/common/cache/upstash-keyv.store.ts` | Custom Keyv-compatible adapter for cache-manager tiered L2 store |
| `backend/src/common/cache/redis.throttler-storage.ts` | Distributed `ThrottlerStorage` backed by Upstash Redis |
| `backend/src/app.module.ts:49-68` | CacheManager registration with L1 (KeyvCacheableMemory) + L2 (UpstashKeyvStore) |
| `backend/src/app.module.ts:71-77` | ThrottlerModule registration with `ThrottlerStorageUpstash` |

### Usage Matrix

| Module | Key Pattern | Purpose | TTL | Fallback |
|---|---|---|---|---|
| **Rate Limiting** | `throttle:{key}` / `throttle:{key}:block` | Rolling window counter + block marker | Configurable (60s default) | In-memory per-instance Map |
| **Like Counts** | `likes:board:{id}` (SET) | O(1) SCARD/SISMEMBER reads | Persistent (no TTL) | Postgres `likes` table |
| **Save Counts** | `saves:board:{id}` (SET) | O(1) SCARD/SISMEMBER reads | Persistent (no TTL) | Postgres `board_saves` table |
| **Trending** | `trending:boards` (ZSET) | Leaderboard sorted by like delta | Persistent | N/A (discovered from DB) |
| **Dirty Boards** | `counters:dirty` (SET) | Tracks boards needing Redis→Postgres reconcile | Persistent (cleaned by cron) | N/A |
| **Feed Cache** | `v:feed:explore` | Version key for cache-aside feed invalidation | Persistent (incremented) | N/A |
| **Feed Cache** | `feed:explore:{sort}:{limit}:{offset}:{version}` (via cache-manager) | Cached explore feed results | 60s (FEED_CACHE_TTL_MS) | Postgres query |
| **Places Cache** | `places:text:{query}:{lat},{lng}:{radius}` (via cache-manager) | Google Places API responses | 24h (PLACES_CACHE_TTL_MS) | Google Places API |
| **Board Presence** | `board:{id}:active` (SET) | Users currently viewing a board | Persistent (cleaned on disconnect) | N/A |
| **Chat Presence** | `presence:{userId}` | Online status for DMs | 120s (auto-expire) | N/A |
| **Cache Namespace** | `cache::*` (SCAN+UNLINK) | KeyvAdapter cache keys (L2 tier) | 60s (L1) / varies | Postgres query |
| **Cron Lock** | `lock:cron:counters-reconcile` | Distributed lock for reconcile job | 240s (auto-expire) | N/A |

### Cache Invalidation Strategy

- **Feed versioning**: `v:feed:explore` is incremented (`INCR`) on board create/delete/visibility change. Cache keys embed this version, so stale entries miss naturally without explicit invalidation.
- **Counter reconciliation**: A cron job (`@Cron(EVERY_5_MINUTES)`) rebuilds Redis sets from Postgres for dirty boards, ensuring Redis eviction never permanently corrupts a counter.
- **Write-through**: Like/save toggles write to Postgres AND Redis simultaneously. Postgres is the source of truth.

### Redis Failure Behavior

| Operation | Fallback on Redis Down |
|---|---|
| Rate limiting | Per-instance in-memory counters (unshared) |
| Like/save counts | Postgres direct query |
| Trending board IDs | Empty array (no trending data) |
| Feed cache | Direct Postgres query (no caching) |
| Places cache | Direct Google Places API call (billed) |
| Board presence | Empty presence list |
| Chat presence | All users appear offline |
| Feed version bump | Silently ignored (`catch(() => undefined)`) |

---

## 2. Critical Findings (P0)

**None identified.** All P0 issues from prior audits have been fixed (broken `/u/[id]` route, socket cleanup, auth flows, token leaks, etc.).

---

## 3. High Findings (P1)

### H1. CSRF Protection Disabled

**File**: `backend/src/main.ts:11`
```
// import { doubleCsrf } from 'csrf-csrf';
```

**Impact**: The `csrf-csrf` package is installed (`backend/package.json:42`) but commented out. Without CSRF protection, cross-origin form submissions could perform authenticated actions (create/delete boards, send messages) if the browser sends cookies. Currently mitigated by using `localStorage` tokens (no cookies), but if cookie-based auth is added this becomes critical.

**Recommendation**: Either remove the unused `csrf-csrf` dependency or enable it. If using localStorage tokens exclusively, document that CSRF is not needed and remove the dead code.

### H2. Refresh Tokens in localStorage (XSS Risk)

**File**: `web/lib/auth.ts:17-29`

**Impact**: Both access and refresh tokens are stored in `window.localStorage`. Any XSS vulnerability in the web app (including third-party scripts or compromised dependencies) can exfiltrate the refresh token, which has a 7-day TTL and grants full account access. The refresh token is also accessible to Socket.IO connections, expanding the attack surface.

**Recommendation**: Consider `httpOnly` cookie-based refresh tokens for the web app. The mobile app correctly uses `expo-secure-store`.

### H3. Google OAuth Tokens in Redirect URL Query Parameters

**File**: `backend/src/auth/auth.controller.ts:103-106`

```typescript
url.searchParams.set('access_token', tokens.accessToken);
url.searchParams.set('refresh_token', tokens.refreshToken);
```

**Impact**: JWTs are appended to the redirect URL as query parameters. These appear in browser history, server logs, and the Referer header for any outbound links from the callback page. An attacker with access to browser history or logs can steal the tokens.

**Recommendation**: Use a short-lived authorization code exchanged server-side, or use `httpOnly` cookies set by the backend before redirecting. At minimum, clear browser history on the callback page.

### H4. `ilike` Search Without Trigram Index

**File**: `backend/src/discovery/discovery.service.ts:119`, `backend/src/users/users.service.ts:59`

```typescript
ilike(boards.title, needle)   // %query% pattern
ilike(users.name, `%${q}%`)   // %query% pattern
```

**Impact**: PostgreSQL `ILIKE '%needle%'` with leading wildcard cannot use B-tree indexes. On tables with >10k rows, these queries will scan the full table. `boards.title` and `users.name` have no trigram index for LIKE operations.

**Recommendation**: Add a GIN/trigram index (`CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE INDEX boards_title_trgm ON boards USING gin (title gin_trgm_ops);`) or migrate to `tsvector` full-text search.

### H5. Backend Has No Test Coverage

**File**: `backend/src/app.controller.spec.ts` (only test file)

**Impact**: Zero test coverage for auth, boards, chat, users, discovery, counters, uploads modules. No unit tests, no integration tests, no e2e tests. The `pnpm test` script exists but runs a single placeholder spec.

**Recommendation**: Add at least integration tests for auth flows (register, login, refresh, password reset), board CRUD with permission checks, and like/save toggles.

### H6. No `NEXT_PUBLIC_API_URL` Environment Variable

**File**: `web/lib/auth.ts:59-60`

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
```

**Impact**: `web/lib/api.ts:23` uses `process.env.API_URL` (server-side only), while `web/lib/auth.ts:60` uses `process.env.NEXT_PUBLIC_API_URL`. The `refreshAccessToken()` function runs client-side but reads a server-only env var, which will always be `undefined` in the browser. The hardcoded fallback works but means the refresh endpoint is always `http://localhost:3000` in production.

**Recommendation**: Use `NEXT_PUBLIC_API_URL` consistently in `web/lib/api.ts` for client-side fetches, or use `API_URL` (server-only) consistently for server-side page renders. Add `NEXT_PUBLIC_API_URL` to `.env.example`.

---

## 4. Medium Findings (P2)

### M1. `setMany` TTL Race in UpstashKeyvStore

**File**: `backend/src/common/cache/upstash-keyv.store.ts:47-61`

**Impact**: `setMany()` calls `mset()` then sets individual TTLs via `expire()`. Between `mset` and `expire`, entries exist without TTLs. If the process crashes after `mset` but before all `expire` calls, some entries persist forever (no TTL = no expiry). This is unlikely but can cause stale cache entries.

**Recommendation**: Use a Redis pipeline or MULTI/EXEC to atomically set keys with TTLs, or accept the risk and add a periodic cache sweep.

### M2. `ThrottlerStorageUpstash` TTL Not Set on Counter

**File**: `backend/src/common/cache/redis.throttler-storage.ts:69-72`

**Impact**: `INCR` on the counter key does not set a TTL unless it's the first hit (`totalHits === 1`). If the `expire` call fails or the process crashes after `incr` but before `expire`, the counter key has no TTL and will persist forever, blocking future requests.

**Recommendation**: Use a Lua script or MULTI/EXEC to atomically increment and set TTL, or always call `expire` after `incr` regardless of hit count.

### M3. `findMine` N+1-Adjacent Queries

**File**: `backend/src/boards/boards.service.ts:128-149`

**Impact**: `findMine()` runs 3 separate queries (owned, member, saved) then calls `decorateBoards()` which runs 5 more queries (owners, members, item counts, like counts, batch roles). Total: ~8 queries per call. Not critical but could be slow with many boards.

**Recommendation**: Consider a single query with a CTE or `UNION` for the board list, and ensure `decorateBoards` remains batched.

### M4. `discovery.decorate()` Runs Per-Board `likeCount`/`saveCount`

**File**: `backend/src/discovery/discovery.service.ts:203-209`

**Impact**: For each board in the feed, `likeCount` and `saveCount` are called individually via `Promise.all`. Each call hits Redis (SCARD) or falls back to Postgres. For a feed of 20 boards, that's 40 Redis calls.

**Recommendation**: Batch SCARD calls or use a pipeline. Alternatively, maintain a single hash or sorted set with counts.

### M5. `chat.service.listConversations()` Fetches All Messages for `lastMessage`

**File**: `backend/src/chat/chat.service.ts:431-449`

**Impact**: `lastMessagePerConversation()` fetches the 50 most recent messages across ALL conversations, then picks the latest per conversation in JS. For users with many active conversations, this could return more data than needed.

**Recommendation**: Use a window function or correlated subquery to get exactly one message per conversation.

### M6. `BoardsGateway` Shared Server with `ChatGateway`

**Files**: `backend/src/boards/boards.gateway.ts:65`, `backend/src/chat/chat.gateway.ts:27`

**Impact**: Both gateways use `@WebSocketGateway({ cors: { origin: true, credentials: true } })` with `cors: { origin: true }`. The `origin: true` reflects the requesting origin, which means any website can connect via Socket.IO. While JWT auth protects data, an attacker could enumerate active board rooms or spam join attempts.

**Recommendation**: Restrict `cors.origin` to the configured `FRONTEND_URL` instead of `true`.

### M7. No `Content-Security-Policy` or `X-Frame-Options` Headers

**File**: `backend/src/main.ts:23`

**Impact**: `helmet()` is enabled with default settings, which includes basic CSP but no frame protection. The app embeds images from user-uploaded URLs (via `<Image>`), which could be used for clickjacking if the app is embedded in an iframe.

**Recommendation**: Configure helmet with explicit CSP directives and `X-Frame-Options: DENY`.

### M8. No Request ID or Correlation ID

**File**: `backend/src/main.ts`

**Impact**: No request ID is generated or logged. In production, correlating logs across multiple API requests (especially for the same user action) is difficult.

**Recommendation**: Add `@nestjs/terminus` or a custom middleware that generates a UUID request ID and adds it to the response headers and log context.

### M9. `fetchBoard` Makes Two Requests on Board Page Load

**Files**: `web/app/boards/[id]/page.tsx:15,34`

**Impact**: `generateMetadata` calls `fetchBoard(id)` for metadata, then the page component calls `fetchBoard(id)` again for the view. That's 2 API calls for the same board on every page load.

**Recommendation**: Pass the board data from `generateMetadata` to the page component, or use Next.js `cache()` to deduplicate.

### M10. `socket.io` CORS `origin: true` in Both Gateways

**Files**: `backend/src/boards/boards.gateway.ts:65`, `backend/src/chat/chat.gateway.ts:27`

**Impact**: Same as M6 — any origin can establish a Socket.IO connection. Combined with JWT auth, this limits data exposure, but it's still an unnecessary attack surface.

**Recommendation**: Use `cors: { origin: frontendUrl }` with the configured `FRONTEND_URL`.

---

## 5. Low Findings (P3)

### L1. `express.static` Serves Uploads Without Cache Headers

**File**: `backend/src/main.ts:21`

**Impact**: Uploaded images served from disk have no explicit cache headers. Browsers will re-request on every page load.

**Recommendation**: Add `maxAge` to `app.useStaticAssets()` for the uploads directory.

### L2. `socket.io-client` in `web/lib/socket.ts` Uses Singleton Without Reconnection

**File**: `web/lib/socket.ts:13-28`

**Impact**: The socket is created once and never reconnects if the connection drops. Users must reload the page to restore realtime features.

**Recommendation**: Add `reconnection: true` to socket options or implement a reconnect mechanism.

### L3. `mail.service.ts` Logs Email Address in Warning

**File**: `backend/src/common/mail/mail.service.ts:31-33`

**Impact**: `this.logger.warn(...${to}...)` logs the user's email address. While not a secret, it could violate privacy policies in production logs.

**Recommendation**: Log only a masked version of the email (e.g., first 3 chars + `***`).

### L4. `users.service.updateProfile` Spreads DTO Directly

**File**: `backend/src/users/users.service.ts:172-175`

```typescript
.set({ ...dto, updatedAt: new Date() })
```

**Impact**: If `UpdateProfileDto` has additional fields added later, they could be set unintentionally. Currently safe (only `name`, `bio`, `avatarUrl`), but fragile.

**Recommendation**: Explicitly destructure only the allowed fields.

### L5. `discovery.feed` Caches Unconditionally for Empty Results

**File**: `backend/src/discovery/discovery.service.ts:70-77`

**Impact**: An empty search result is cached for 60s. If boards are created during that window, they won't appear until the cache expires.

**Recommendation**: Consider not caching empty results, or using a shorter TTL for empty results.

### L6. `counters.reconcileCounters` Uses Redis Lock Without Clock Skew Protection

**File**: `backend/src/counters/counters.service.ts:154-157`

**Impact**: The lock has a 240s TTL. If the reconcile job takes longer than 240s (unlikely but possible with many dirty boards), another instance could start reconciling simultaneously.

**Recommendation**: Extend the lock TTL or refresh it during execution.

### L7. No `X-Content-Type-Options: nosniff` on Upload Serving

**File**: `backend/src/main.ts:21`

**Impact**: `app.useStaticAssets()` uses Express static middleware, which should set `nosniff` by default, but it's worth verifying.

**Recommendation**: Verify helmet or Express static middleware sets this header. If not, add it explicitly.

### L8. `BoardMembers` Search Dropdown Has No Debounce

**File**: `web/components/board-members.tsx:78-91`

**Impact**: `handleSearch` fires on every keystroke, making an API call per character typed. This creates unnecessary network traffic.

**Recommendation**: Add debounce (300ms) to the search input.

### L9. `chat-view.tsx` `fetchPresence` Hardcodes Path

**File**: `web/components/chat-view.tsx:849-854`

**Impact**: `fetchPresence()` builds the URL manually rather than using a typed API function. Minor inconsistency.

**Recommendation**: Move to `web/lib/api.ts` as a named export.

### L10. `upstash-keyv.store.ts` `clear()` Uses SCAN Without Timeout

**File**: `backend/src/common/cache/upstash-keyv.store.ts:96-108`

**Impact**: `clear()` iterates via SCAN with no timeout. If the namespace has millions of keys, this could run for a long time.

**Recommendation**: Add a max-iterations guard or timeout.

---

## 6. Fixed / Resolved

The following issues from prior audits have been confirmed fixed:

| Issue | Status | Commit/Location |
|---|---|---|
| Broken `/u/[id]` route → `/user/[id]` | Fixed | `web/app/user/[id].tsx` |
| Socket cleanup + stale myId in chat | Fixed | `chat-view.tsx` cleanup effect |
| Like/save initialized from API | Fixed | `board-detail.tsx` uses API response |
| Followers/following tab rendering | Fixed | `user/[id].tsx` |
| Tab icon `require()` failures | Fixed | `app-tabs.tsx` (no require()) |
| Unhandled promise in web handleLike | Fixed | Wrapped in try/catch |
| Inconsistent API_URL in forgotPassword/resetPassword | Fixed | `web/lib/api.ts` |
| `addMember` swallowing all DB errors as ALREADY_MEMBER | Fixed | Error code 23505 check |
| Inline string instead of MESSAGES constant in resetPassword | Fixed | Uses MESSAGES.AUTH.INVALID_RESET_TOKEN |
| `pageParam` unsafe cast fallbacks | Fixed | Optional chaining |
| `setTimeout` cleanup in settings | Fixed | Cleanup in useEffect |
| Avatar upload error display | Fixed | Error state display |
| `api.me()` cached via React Query | Fixed | Direct fetch call |
| Mail failure logging | Fixed | Token URL removed from logs |
| `RoleIcon` extracted outside component | Fixed | Defined outside component |
| `typingTimerRef` cleared on unmount | Fixed | Cleanup in useEffect return |
| `<img>` → Next.js `<Image>` in 3 web components | Fixed | `site-header.tsx`, `chat-view.tsx`, `board-members.tsx` |
| Search dropdown outside-click handler | Fixed | `mousedown` event listener |
| `loading.tsx`/`error.tsx` for key routes | Fixed | Added for `/boards/[id]`, `/chat`, `/search` |
| Batch role lookups in `decorateBoards` | Fixed | `batchRoles()` method |
| `toggleLike`/`toggleSave` wrapped in transactions | Fixed | `db.transaction()` wrapping |
