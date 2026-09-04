# Travel Board App — Plan & Feature List

**One-liner:** A visual, social platform (Pinterest-style) where people discover, create, save, and collaboratively plan trips through shareable travel boards.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Web | Next.js + TypeScript |
| Mobile | React Native (Expo) |
| Backend | NestJS |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle |
| Cache | Upstash Redis (serverless, REST-based) |
| Rate limiting | @nestjs/throttler + Upstash Redis storage |
| Auth | Google OAuth + email/social login |
| Image storage | Cloudflare R2 / S3-compatible |
| Maps / Places | Google Maps / Places API |
| Search | Postgres full-text → Meilisearch later |
| Ads | Google AdSense (web) |
| API style | REST |
| Deployment | Vercel (web) + Render/Railway (API) |

**Architecture rule:** Web and mobile never talk to Postgres directly — both are clients of the single NestJS API. All business logic lives in NestJS.

```
PostgreSQL (Neon)        Upstash Redis (cache / rate-limit / counters)
        ↑                          ↑
        └──────── NestJS API ──────┘
                       ↑
                 ┌─────┴─────┐
             Next.js     React Native
              (Web)        (Mobile)
```

### 1.1 Caching & Rate Limiting Layer (Upstash Redis)

**Why Upstash:** REST-based serverless Redis — no TCP/socket management, works identically on long-running servers (Render/Railway) and serverless (Vercel), with global replication, per-key TTLs, and a generous free tier. It is the single Redis provider for the API.

**Packages (backend):**

| Package | Purpose |
|---|---|
| `@upstash/redis` | Primary Redis client — cache-aside reads, counters (likes/saves), temp data, throttler storage |
| `keyv` + `cacheable` (already transitively present) | Keyv store wiring for `@nestjs/cache-manager` |
| `keyv-upstash` *(optional)* | Keyv adapter for Upstash → plugs straight into `CacheModule` (see caveat below) |

**Tiered caching design (L1 → L2 → L3):**

- **L1 (per API instance):** in-memory `KeyvCacheableMemory` (~5k LRU) — zero-latency, resets on restart.
- **L2 (shared across instances):** Upstash Redis — the real distributed cache.
- **L3 (source of truth):** Postgres.

> ⚠️ **`keyv-upstash` caveat:** last published ~2 years ago with near-zero adoption. Preferred path is a ~50-line custom Keyv store adapter wrapping the official `@upstash/redis` client (same Keyv interface, official dependency). Decision tracked in Open Decisions.

**What we cache (default TTLs):**

| Data | Cache key | TTL | Notes |
|---|---|---|---|
| Explore feed (anonymous) | `feed:explore:{sort}` | 60s | invalidate on new public board |
| Board detail (public) | `board:{id}` | 60s | invalidate on edit |
| Google Places responses | `places:{query}` | 24h | **biggest win — cuts Google Places API spend** |
| Public profile | `user:{id}:profile` | 5m | |
| AI trip drafts | `ai:trip:{id}` | 1h | cheap re-request while editing |
| Trending boards | `trending` | 5m | Redis sorted set, ZINCRBY on like/save |
| Like/save counters | `counters:board:{id}:likes` | — | Redis INCR; periodic flush to Postgres |

**Rate limiting:** keep `@nestjs/throttler` (already installed); back it with a custom `ThrottlerStorage` implemented on `@upstash/redis` so limits are distributed and survive restarts. Tighter limits on auth, AI-generation, and Places-proxy endpoints.

**Environment variables:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

**Key naming:** namespaced `resource:id:field` (`board:123`, `user:7:profile`). Never cache private board content for anonymous users.

---

## 2. Data Model (high level)

```
users
 ├── boards
 │     ├── board_members     (owner / editor / viewer)
 │     ├── board_sections     (e.g. "Day 1", or freeform for non-itinerary boards)
 │     │     └── board_items  (place, image, note, link, restaurant, hotel, activity)
 │     └── board_saves        (users saving other boards)
 ├── follows                  (user → user / user → board)
 ├── likes
 └── comments

places
 ├── destinations
 ├── restaurants
 ├── hotels
 └── attractions
```

`board_items` fields: `id, board_id, section_id, type, place_id, title, description, image, url, position, created_at`
`type` enum: `PLACE | IMAGE | NOTE | LINK | RESTAURANT | HOTEL | ACTIVITY`

Boards support two shapes:
- **Day-based itinerary boards** (Day 1, Day 2, …)
- **Freeform collection boards** (e.g. "Places I want to visit in Europe")

---

## 3. Feature List

### 3.1 Travel Boards (core)
- Create / edit / delete board
- Cover image, title, description, destination, dates
- Public / private visibility
- Sections (day-based or freeform)
- Add items: place, image, note, link, restaurant, hotel, activity
- Reorder items via drag & drop
- Share board (link)

### 3.2 Pinterest-style Discovery
- Explore feed (masonry grid of board covers)
- Board detail view (cover, title, day count, destinations, like count, share)
- Search boards / places / destinations

### 3.3 Save / Bookmark
- "Save to..." flow — save any board or item into one of the user's own boards
- Create new board directly from the save flow

### 3.4 Collaboration
- Invite users to a board
- Roles: Owner / Editor / Viewer
- Add / remove / reorder items based on role
- (Later) real-time-ish sync

### 3.5 Social Graph
- Follow users, boards, or destinations
- Following feed
- Likes and comments on boards

### 3.6 Trip / Places Data
- Google Places search integration
- Map view of a board's places
- Dates and simple itinerary structure

### 3.7 AI "Build My Trip" (differentiator)
- Input: destination, days, budget, travel style, starting city
- Output: a draft day-by-day board the user can edit visually
- This is the feature that separates the app from a plain Pinterest clone

### 3.8 Monetization
- **Free tier:** unlimited boards, basic collaboration, ads
- **Premium tier:** no ads, advanced itinerary tools, offline trips, advanced collaboration, PDF export, AI itinerary generation, more storage
- AdSense placement: only in discovery/explore surfaces (feed, board detail) — never inside the board editor
- Mobile: AdSense is web-only — mobile needs a separate ad SDK (e.g. AdMob) or ads can be deferred to post-MVP
- Sponsored travel content placements (later)

---

## 4. Build Phases

| Phase | Scope |
|---|---|
| **1 — Auth** | Google login, email login, profile, Upstash Redis setup, cache & rate-limit wiring |
| **2 — Boards** | Create/edit/delete, public/private, cover image, sections, items |
| **3 — Social** | Explore feed (Redis-cached), like, save, follow, share, like/save counters + trending in Redis |
| **4 — Travel data** | Places search (Google Places responses cached in Redis), maps, dates, basic itinerary |
| **5 — Collaboration** | Invite users, roles, real-time-ish updates |
| **6 — Monetization** | AdSense, premium tier, sponsored content |
| **7 — AI trip builder** | "Build my trip" generator (can slot in after Phase 4, before launch or as fast-follow) |

### Recommended MVP for first Play Store release
Phases 1–3 + a minimal Phase 4 (manual place entry, no AI generation yet, no ads yet). This gets a usable, shareable, savable board product out fast; AI generation and monetization can follow as updates.

---

## 5. Open Decisions to Track
- Whether AdSense-on-web launches with v1 or is added after traction
- Mobile ad network choice (if ads are wanted on mobile before Premium exists)
- Real-time collaboration approach (polling vs. websockets vs. a service like Liveblocks) — can start with simple polling/refresh and upgrade later
- Search: Postgres full-text is fine until board/place volume grows, then move to Meilisearch
- Upstash integration: `keyv-upstash` vs. custom Keyv store over `@upstash/redis` (see architecture.md)
- Cache invalidation: TTL-only for MVP vs. event-driven invalidation (version-bumped keys on writes) later
- Upstash region: pick one close to the API host (Render/Railway) for lowest latency