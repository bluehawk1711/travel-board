# Travel Board — Codebase Summary

> A Pinterest-style social platform where people discover, create, save, and
> collaboratively plan trips through shareable travel boards.
> This document is a working summary of the repository as read on 2026-10-15.

---

## 1. Monorepo layout

| Path | What it is | Size |
|---|---|---|
| `backend/` | NestJS 11 API — all business logic | ~7.8k LOC TS |
| `web/` | Next.js 16 App Router + Tailwind 4 + React Query | ~15k LOC TS/TSX |
| `mobile/` | Expo 57 + Expo Router + NativeWind + React Query + Zustand | ~11k LOC TS/TSX |
| `shared/` | `@travel-board/shared` — brand tokens, theme dictionary, `UI_MESSAGES` copy (raw TS, consumed via `file:` deps) | 1 file |
| `packages/`, `scripts/`, `stitch_travel_board_ui/` | tooling / design source material | — |

Root `package.json` scripts: `pnpm dev` (all three apps via `concurrently`),
`dev:api` / `dev:w` / `dev:m`, `build` (backend + web), `test` (backend jest).

Packages are wired with pnpm `file:` deps (`@travel-board/shared`) — web
transpiles it via `next.config.ts transpilePackages`, mobile via its
tsconfig path mapping (`@travel-board/shared` → `../shared/index.ts`).

Docs: `plan.md` (feature plan + production-polish phases), `architecture.md`
(system design, caching tables), `features.md` (MoSCoW priorities),
`issues.md` (audit findings), `testing.md` (E2E smoke results, 75/75),
`AGENTS.md` (binding rules: messages file, UI reuse, quality gates, git rules).

---

## 2. Backend (NestJS + Drizzle + Postgres/Neon + Upstash Redis)

### Bootstrap
- `main.ts`: request-id middleware, cookie-parser, static `/uploads` (1-day cache),
  compression, helmet (CSP off), CORS to `FRONTEND_URL`, global
  `ValidationPipe { whitelist, transform }`, `GlobalExceptionFilter`, pino logs.
- `app.module.ts`: global ConfigModule, LoggerModule (pino), ScheduleModule,
  global RedisModule (`REDIS_CLIENT` = `@upstash/redis`), tiered CacheModule
  (L1 `KeyvCacheableMemory` 60s/5000 → L2 custom `UpstashKeyvStore`),
  ThrottlerModule (default 100 req/min, `ThrottlerStorageUpstash`), and all
  feature modules.

### Data model (`backend/src/db/schema.ts`, 6 migrations in `backend/drizzle/`)
- `users` (passwordHash nullable for OAuth-only, trigram GIN on name),
  `boards` (owner, title, destination, `board_type` ITINERARY|FREEFORM,
  visibility PUBLIC|PRIVATE, startDate/endDate, coverImageUrl, trigram GIN on title),
  `board_members` (OWNER|EDITOR|VIEWER, composite PK),
  `board_sections` / `board_items` (type enum PLACE|IMAGE|NOTE|LINK|RESTAURANT|HOTEL|ACTIVITY,
  position ordering, placeId, lat/lng, date), `board_saves`, `likes`, `comments`,
  `follows` (polymorphic USER|BOARD), `refresh_tokens` + `password_reset_tokens`
  (SHA-256 hashed), `conversations`/`conversation_members`/`messages`
  (bigint identity ids → cursor pagination + read tracking), `user_settings`,
  `push_tokens`, `notifications` (7 types + jsonb metadata).

### Auth
- Global `JwtAuthGuard` + `@Public()` (optional-auth: `req.user` attached when a
  valid token is present, never blocks anonymous). Access JWT 15 min,
  refresh 7 days rotated on use, stored hashed in `refresh_tokens`.
- Credentials delivered both as **Bearer tokens (mobile/SPA memory)** and
  **httpOnly cookies** (`tb_access_token`, `tb_refresh_token` scoped to `/auth`)
  for the web app; `JwtStrategy` prefers the header, falls back to cookie.
- Google OAuth: Passport redirect flow for web (`/auth/google` +
  `/auth/google/callback` → cookies + redirect to `/auth/callback`),
  `POST /auth/google/mobile` id_token exchange (google-auth-library) for Expo.
- Password reset via `MailService` (Resend; no-ops with a warning when the key
  is missing). bcrypt 10 rounds; `MESSAGES.AUTH.*` for every message.

### Modules
- **boards**: service-layer permission helpers (`getRole` → `assertCanEdit` /
  `assertIsOwner`); private boards 404 for non-members; sections/items CRUD,
  validated reorder (exact id-set check), `copyBoard` (public source → private
  copy), `findMine` (UNION of owned/member/saved), `findSaved`, member
  management by email (owner-only). Controllers broadcast `board:change`
  events after the DB write.
- **chat**: DIRECT/GROUP/BOARD conversations; unread counts from
  `lastReadMessageId`; presence keys in Redis (`presence:{userId}`, 120s TTL);
  notifications fan-out on message.
- **discovery**: public explore feed (`newest`/`trending`/`q` search),
  `GET /explore/following`; cache key embeds `v:feed:explore` version so
  board writes bust stale feeds naturally; like/save counts batched via Redis pipeline.
- **counters**: likes/saves write through to Postgres **and** maintain Redis
  sets (`likes:board:{id}`, `saves:board:{id}`) + `trending:boards` ZSET;
  5-min cron with a Redis lock rebuilds dirty sets from Postgres (Redis is disposable).
- **follows / comments / notifications / push / places / uploads / users**:
  polymorphic follows, board comments (author-or-owner delete), inbox +
  unread count + mark read, FCM v1 delivery (degrades to no-op without creds),
  Google Places proxy (server-side key, 24h cache, 30 req/min throttle),
  local-disk image upload (`/uploads`, 5MB, jpeg/png/webp/gif, 20/min),
  profile/settings (`user_settings` lazily created).

### Realtime
One Socket.IO server; shared JWT handshake (`common/ws/jwt-socket-auth.ts`).
- `ChatGateway`: auto-joins a user's rooms on connect; `conversation:join`,
  `message:send` (ack + per-socket flood guard 20/10s) → `message:new`,
  `message:typing` → `user:typing`, `message:read` → `conversation:read`.
- `BoardsGateway`: `board:join`/`board:leave` (permission-checked),
  presence from `board:{id}:active` set → `board:presence`,
  `broadcastBoardChange` emits `board:change` for every REST mutation
  (`board:updated/removed`, `section:*`, `item:*`, `items:reordered`,
  `sections:reordered`) — sockets are the notification layer, Postgres stays
  the source of truth (last-write-wins on clients).

### Conventions
- **All** user-facing strings live in `backend/src/common/messages.ts` (`MESSAGES.*`).
- class-validator DTOs everywhere; `import type` for decorator signature types.
- Redis keys `resource:id:field`; every cache write has a TTL.
- Quality gates: `pnpm lint && pnpm build && pnpm test` in `backend/`;
  `pnpm --dir backend test:api` runs the 75-check E2E smoke suite.
- Git: **no AI footers/co-authors**, no pushes unless asked.

---

## 3. Web (Next.js 16)

- `cacheComponents: true`; explore page streams the feed behind `<Suspense>`;
  `boards/[id]` is an RSC that forwards the cookie header to the API so it can
  authorize private boards; 404 → `notFound()`.
- `proxy.ts` (Next 16 middleware): guards `/boards`, `/settings`, `/following`,
  `/onboarding`, `/chat` by session-marker cookie → `/login?next=…`.
  `next.config.ts` sets CSP/security headers.
- Client auth (`lib/auth.ts`): in-memory access token (never localStorage),
  httpOnly refresh cookie, deduped `refreshAccessToken()`,
  `tb_auth` marker cookie, `tb:auth` CustomEvents; `useSessionBootstrap`
  re-hydrates after hard reloads; `useSignedIn` via `useSyncExternalStore`
  (server snapshot `false` → no hydration mismatch).
- Data: React Query everywhere (`lib/queries.ts` central `queryKeys`,
  staleTime 30s), transport in `lib/api.ts` (`authFetch` with one
  refresh-and-retry on 401), board mutations in `lib/board-edit.ts`,
  socket patches via `applyBoardChange` (`lib/board-types.ts`).
- Key surfaces: explore masonry feed (+ planner filters, hero, pagination),
  My Boards, board detail (cover upload via drag/label, optimistic like/save,
  live presence pill, `BoardEditor` with react-draggable sections +
  sortable item grid + details tab, `BoardChat` + `BoardMembers` sheets),
  `ChatView` (conv list w/ unread badges, typing, presence, DM/group modal),
  notifications, settings, profile, onboarding page.
- UI: shadcn/ui primitives in `components/ui/` + community blocks in
  `components/shadcn-space/` (AGENTS §4: never hand-roll what the library has).

---

## 4. Mobile (Expo)

- Navigation: expo-router typed routes. Root `_layout` hydrates auth +
  onboarding stores, mounts `useAuthGuard` (redirects between `(auth)` and
  `(tabs)`, first-run → onboarding carousel) and `usePushRegistration`.
- State: `useAuthStore` (Zustand: `hydrate`/`setSession`/`signOut` →
  `POST /auth/logout`), `useOnboardingStore` (AsyncStorage `onboarding.seen`),
  React Query for server state (staleTime 60s).
- Transport: `lib/api.ts` — SecureStore tokens (in-memory on web), deduped
  refresh, `ApiError { status }`, absolute `/uploads` URLs.
- Screens: My Boards (Mine/Saved chips, FlashList, notifications bell badge),
  Explore (infinite feed + debounced search + sort), Following, search,
  board detail (realtime `board:change` patching, ↑/↓ reorder for sections and
  items, section CRUD, `ItemFormModal` with Google Places search + image upload,
  members modal, comments, map route, edit route), chat (REST send + socket
  `message:new`/typing/read), settings (profile, avatar, preferences),
  notifications, user profile, `(auth)` group: onboarding carousel (4 slides,
  bundled Stitch photography), sign-in, sign-up, forgot/reset password,
  Google sign-in via `expo-auth-session` → `POST /auth/google/mobile`.
- Design system: Terra Nova Travel tokens in `@travel-board/shared` (`THEME`)
  mirrored into `constants/theme.ts` (`Colors`, `Spacing`, `Radius`, `Shadows`,
  `Fonts`); reusable primitives `ThemedText`/`ThemedView`,
  `PillButton`/`Chip`/`Badge` (`components/ui/pill-button.tsx`), `Toast`.

---

## 5. Known cross-client mismatches (observed while reading)

1. `mobile/src/lib/api.ts` types `getProfile` as `{ user: PublicProfile }` but
   `GET /users/:id` returns the profile **flat** (web documents this).
2. Mobile `createSection`/`updateSection`/`createItem`/`updateItem` type
   wrapped responses (`{ section }` / `{ item }`) while the API returns the
   entity directly — latent (callers ignore the payload today).
3. Web header sign-out only clears local state — it never calls `POST /auth/logout`.
4. `web/lib/board-types.ts` `BoardChangeType` is missing `'sections:reordered'`
   (mobile has it), so web's `applyBoardChange` ignores that event.
5. Web's item editor has no Places search / lat / lng / date (mobile's does).

---

## 6. Environment

Required backend env (`backend/.env`): `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_PLACES_API_KEY`, `JWT_SECRET`,
`JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_CALLBACK_URL`, `FRONTEND_URL` (+ optional `RESEND_API_KEY`, FCM creds).
Clients: `NEXT_PUBLIC_API_URL` (web), `EXPO_PUBLIC_API_URL` (mobile).
