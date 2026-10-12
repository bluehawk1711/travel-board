# Implementation Plan — Social Feed + FCM + Shared Theme

## Current state (verified by reading every relevant file)

| Layer | What exists | What is missing |
|---|---|---|
| **Backend** | `follows/` module (follow/unfollow users + boards, follower/following lists, `isFollowing`, counts), `users/profile`, `users/:id/boards`, `discovery/explore` + `/following`, Redis counters for likes/saves, `userSettings` (themeMode, notificationsEnabled), `auth/` full JWT+OAuth | No feed actor concept, no FCM push layer, no notifications table, no unread-badge concept |
| **Web** | `app/page.tsx` (explore), `app/following/page.tsx`, `app/u/[id]/page.tsx` (profile), `site-header.tsx`, `user-profile.tsx`, Tailwind 4 globals with Terra Nova palette, shared `@travel-board/shared` | No React Query installed, client pages call `lib/api.ts` directly via `useEffect`/`useState`, no caching layer, auth token in memory (not cookie) |
| **Mobile** | Expo Router tabs: `index` (my boards), `explore`, `following` (buggy — hits `/explore?sort=newest`), `search`, `profile`; `lib/api.ts` has follow/saved/profile methods, React Query installed, `useTheme()` + `ThemedView`/`ThemedText`, `expo-notifications` in deps | Following screen calls wrong endpoint, no follow/unfollow UI, no notifications tab, `getSavedBoards` stub, no push token registration, theme tokens not unified from `shared/` |


---

## Phase 0 — Guard rails

- Root `package.json` already has `concurrently` scripts. Verify `pnpm dev` starts all three.
- Type hygiene: grep all three projects for `as any`, `: any`, `any[]`, loose `unknown`. Fix in backend DTOs, web+mobile `lib/api.ts` (replace `res.json() as {…}` casts with typed helpers). Acceptance: zero `as any` in `src/`, `app/`, `mobile/src/`; all three `tsc --noEmit` clean.
- Preexisting fixes: mobile `following.tsx` calls `/explore?sort=newest` instead of `/explore/following` — fix to real feed. Mobile `getSavedBoards` is a stub — wire to backend `GET /boards/saved` (Phase 2) or remove stub. Chat socket event mismatch (mobile `chat:join/leave/message` vs backend `conversation:join/leave/message:send`) — fix or ticket.

**Key facts:** `follows.service.ts` is polymorphic (USER|BOARD) with full follow primitives. `discovery.service.ts` has `followingFeed()`. `counters.service.ts` maintains Redis counters. `userSettings.themeMode` exists. `expo-notifications` installed. `shared/index.ts` exports `BRAND_COLORS`, `THEME_MODES`, `UserSettings`.
