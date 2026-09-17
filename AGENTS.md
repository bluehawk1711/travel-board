# AGENTS.md — Rules & Regulations for AI Agents

This file is binding for any AI agent (or human) working in this repository.
Read it before making changes. When in doubt, follow `plan.md` and `architecture.md`.

---

## 1. Project Overview

**Travel Board App** — a Pinterest-style social platform where people discover, create,
save, and collaboratively plan trips through shareable travel boards.

| Layer | Technology | Location |
|---|---|---|
| API (all business logic) | NestJS 11 + TypeScript | `backend/` |
| Web | Next.js 16 App Router + Tailwind 4 | `web/` |
| Mobile | React Native / Expo 57 + Expo Router | `mobile/` |
| Database | PostgreSQL (Neon) + Drizzle ORM | `backend/src/db/` |
| Cache / rate-limit / counters | Upstash Redis (`@upstash/redis`) | `backend/src/common/` |
| Auth | JWT (access + refresh) + Google OAuth (Passport) | `backend/src/auth/` |

---

## 2. Non-Negotiable Architecture Rules

1. **Web and mobile never talk to Postgres or Redis directly.** Both are clients of the
   single NestJS API. All business logic lives in the API.
2. **Postgres is the source of truth.** Upstash Redis is a disposable acceleration layer —
   losing it must never corrupt data. Every Redis write path must have a Postgres fallback
   or recovery path.
3. **External API calls are money.** Anything billed (Google Places, AI generation) must be
   cached (see §6) and proxied server-side — API keys never reach clients.
4. **Private data is never served to anonymous users.** Permission checks (board roles) are
   enforced in the service layer, never in the client.
5. **Follow `plan.md` (features/phases) and `architecture.md` (design)**. Update them when a
   decision changes.

---

## 3. API Module Map (`backend/src/`)

```
main.ts                      # bootstrap: helmet, compression, CORS, global ValidationPipe
app.module.ts                # root wiring (config, cache, throttler, schedule, modules)
common/
  messages.ts                # ★ ALL error/success message strings live here (see §5)
  redis/                     # RedisModule (REDIS_CLIENT), constants
  cache/                     # UpstashKeyvStore, ThrottlerStorageUpstash
db/                          # Drizzle schema.ts, dbProvider.ts (PG_CONNECTION), migrations
auth/                        # register/login/refresh/logout, Google OAuth, JWT guard
boards/                      # boards, sections, items, members + permission checks
counters/                    # Redis like/save counters + cron reconcile to Postgres
discovery/                   # explore feed (Redis-cached)
places/                      # Google Places proxy (24h cache-aside)
```

---

## 4. Conventions

- **TypeScript strict-ish**: `strictNullChecks` on. New code must typecheck with
  `pnpm build` (nest build) in `backend/`.
- **Validation**: every request body/query/param uses `class-validator` DTOs. The global
  `ValidationPipe` (`whitelist: true, transform: true`) is already wired.
- **Types used inside decorated signatures must be imported with `import type`**
  (required by `isolatedModules` + `emitDecoratorMetadata`).
- **Drizzle**: new tables/enums go in `backend/src/db/schema.ts`; relations use the
  `relations()` API; inferred types (`$inferSelect`/`$inferInsert`) are exported per table.
  Regenerate migrations with:
  ```bash
  cd backend && pnpm drizzle-kit generate --config=./src/db/drizzle.config.ts
  ```
- **Naming**: `resource:id:field` for Redis keys (`board:123`, `user:7:profile`);
  kebab-case REST paths; camelCase JS/TS.
- **Dates**: always store `timestamp with time zone` in Postgres; serialize to ISO-8601
  strings in API responses.
- **★ UI components — reuse, never reinvent**: all UI is composed from the component
  library, never hand-rolled inline. `web/components/ui/` (shadcn/ui primitives) and
  `web/components/shadcn-space/` (community blocks) are the only source of UI building
  blocks. When a screen needs a control, reuse one that exists; when one almost fits,
  extend/parametrize the existing component (add props, refactor hardcoded demo data out)
  instead of copying it or writing a new one. New screens must not introduce one-off
  divs/buttons/inputs where a library component is available.

---

## 5. Message Strings (Errors / Success) — ★ MUST FOLLOW

**Never inline a user-facing error or success string in code.** Every message lives in a
single shared file:

```
backend/src/common/messages.ts  →  export const MESSAGES = { AUTH: {...}, BOARDS: {...}, ... }
```

Rules:
- Add new messages to `MESSAGES` in `messages.ts`, then reference them:
  `throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);`
- Group by feature domain (`AUTH`, `BOARDS`, `PLACES`, `COMMON`, …).
- **Never use literal strings in `throw new XException('...')` or response payloads.**
- Changing wording = edit `messages.ts` once; it updates everywhere.

---

## 6. Caching Rules (Upstash Redis)

- Cache writes always set a TTL; never store unbounded data.
- Tiered cache is already configured in `app.module.ts`: in-memory L1 →
  Upstash L2 → Postgres L3.
- **Cache invalidation**: prefer version keys (`v:feed:explore`) that feed cache keys embed,
  so stale collections miss naturally. The boards module bumps the feed version on
  create/delete/visibility change — keep that behavior on any new collection cache.
- Counters (likes/saves): write through to Postgres rows **and** maintain Redis membership
  sets (`likes:board:{id}`, `saves:board:{id}`). Reads use Redis `SCARD` with a Postgres
  fallback. Never let Redis be the only copy.
- Rate limiting: `@nestjs/throttler` with `ThrottlerStorageUpstash` (global default
  100 req/min). Add tighter `@Throttle(...)` on auth, AI, and Places endpoints.

---

## 7. Auth Rules

- The global `JwtAuthGuard` protects every route **unless** the handler (or class) is marked
  `@Public()`. `@Public()` still attaches `req.user` when a valid token is present
  (optional auth).
- Access tokens: 15 min. Refresh tokens: 7 days, rotated on use, stored **hashed**
  (SHA-256) in `refresh_tokens`.
- `@CurrentUser()` reads the authenticated user in controllers.
- Passwords: bcrypt (10+ rounds). Never log or return `passwordHash`.

---

## 8. Quality Gates — run before finishing any task

In `backend/`:
```bash
pnpm lint     # eslint --fix (project style)
pnpm build    # nest build (typecheck)
pnpm test     # jest
```
All three must pass. Then, if feasible, boot-smoke the changed routes.

---

## 9. Git & Commits — ★ MUST FOLLOW

1. **Never co-author commits.** Do NOT append AI/agent attribution footers
   (no "Generated with Codebuff", no "Co-Authored-By: …", no "🤖" markers) to commit
   messages or pull requests. Commits are authored by the repository owner only.
2. Commit messages: concise, imperative, describe the *why* (intent) over the *what*.
   One logical change per commit. `git commit -am` is fine when all staged changes belong
   to that change.
3. **Never `git push` to the remote unless the user explicitly asks.** After pushing,
   confirm success.
4. Never alter git config, rewrite history, or force-push.
5. Review `git diff` before committing; don't stage unrelated or generated files
   (e.g. `node_modules`, `.env`, build output — these are gitignored anyway).
6. `.agents/` is gitignored — skills are local tooling, never committed.

---

## 10. Environment & Secrets

- Secrets only exist in `backend/.env` (see `backend/.env.example`). Never hardcode or
  commit secrets; never put API keys in web/mobile code.
- Required env vars: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  `GOOGLE_PLACES_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`.

---

## 11. Roadmap Reference

MVP phases (see `plan.md`): Auth → Boards → Social → minimal Places. AI trip builder,
ads/premium, realtime sync, and notifications are deliberately deferred past the first
release.
