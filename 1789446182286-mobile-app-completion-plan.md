# Mobile App Completion Plan

**Goal:** Bring the Expo (React Native) mobile client (`mobile/`) from its current partial state to full coverage of the app's MVP + "Should"-priority features from `features.md`, reusing the existing single NestJS API and the shared Socket.IO gateway.

**Status:** Draft · **Target:** `mobile/` only (backend dependencies called out explicitly).

---

## 0. Current State (verified by code reading)

Auth: email/password register, login, forgot/reset work; tokens stored in `expo-secure-store` (web in-memory). No global auth state, no route guard, no Google OAuth, no `/auth/logout` call.
Boards: list (My Boards), create (title/destination/description/visibility only), detail view with cover, sections, items, members modal, like/save.
Missing: cover upload on create, board edit screen, board dates/boardType, section edit/delete/reorder, item types (place/image/restaurant/hotel/activity), item edit, drag reorder, map view.
Discovery: explore feed, following (buggy: calls `/explore?sort=newest` instead of `/explore/following`), search users only.
Chat: conversation list + 1:1 DM view with realtime via Socket.IO.
Places: none client-side yet (backend `GET /places/search` exists).

### Key mismatches / bugs to fix
1. `mobile/src/lib/socket.ts` uses `chat:join`/`chat:leave`/`chat:message`, but the backend `ChatGateway` (`backend/src/chat/chat.gateway.ts:92,110,127`) emits `conversation:join`, `message:new` and listens `message:send`. Realtime chat is currently broken.
2. `api.createItem` posts to `/boards/:boardId/sections/:sectionId/items` **without `sectionId`** in the body, but the backend `CreateItemDto` (`backend/src/boards/dto/item.dto.ts:29`) requires `sectionId`. Item type is also not sent. This will fail validation.
3. `following.tsx` calls `api.getExplore('newest')` instead of a dedicated following feed.
4. No "create board" entry point on the home screen (placeholder text only).
5. `Settings` sign-out clears tokens locally but never calls `POST /auth/logout`.
6. `api.getConversations` type ignores `unreadCount` returned by the backend `ConversationSummary` (`backend/src/chat/chat.service.ts:48`).

---

## 1. Scope & Decisions

**In scope (ship):**
- Auth completion + Google OAuth.
- Full board editor (create/edit, sections, items, cover image, dates, drag reorder).
- Places search → add place/restaurant/hotel/activity items; optional map view.
- Discovery: board search, fixed following feed, saved boards.
- Comments on boards.
- Chat polish: correct socket events, unread badges, typing indicators, read on open.
- Realtime: reconnect, optimistic updates.
- Standard UI plumbing: error/toast, auth gate, web parity fixes.

**Deferred (post-MVP, per `plan.md`):** AI trip builder, ads/premium, push notifications, offline-first (TanStack persist is installed but not wired), PDF export, budget tracking, CRDT conflict resolution (last-write-wins is acceptable).

### Decision log
| Decision | Choice | Rationale |
|---|---|---|
| Auth state | Zustand `useAuth` store + expo router redirect on `initializing` | Project already depends on Zustand; `expo-router` typedRoutes; lighter than React Context boilerplate. |
| Google OAuth | `expo-google-auth-session` (offline access) → POST `/auth/google/mobile` (backend new) with `id_token` | Backend's existing OAuth redirect flow is web-only; mobile needs a token-exchange endpoint. |
| Saved boards | New backend `GET /boards/saved` (mobile cannot compute without DB) | No saved-boards endpoint exists today. |
| Drag reorder | `react-native-draggable-flatlist` (already in `package.json`) | Native, installed, supports sections + items. |
| Map view | `react-native-maps` (already in `package.json`) | Installed; read-only map of board place items. |
| Socket client | Single shared singleton; `conversation:join` for chat, `board:join` for boards; add reconnect + ack handling | Matches the single shared Socket.IO server the backend mounts. |
| Errors | `ApiError` already exists; add a small `toast` hook/component for surface-level feedback | Keeps inline "silent" catches from masking failures. |

---

## 2. Foundation (no user-visible feature)

- **`src/lib/auth.ts`** (new): `useAuth` Zustand store — `accessToken`, `user`, `status: 'loading'|'authenticated'|'unauthenticated'`, with `hydrate()` on app start (uses existing `getAccessToken`/`saveTokens`/`clearTokens`). Exposes `signIn`, `signOut` (calls `api.logout` then clears).
  - Wire into `src/app/_layout.tsx`: call `auth.hydrate()` on mount; redirect to `/(auth)/sign-in` until resolved.
  - `src/app/(tabs)/_layout.tsx` or a wrapper guards tabs → redirect to auth if unauthenticated.
- **API client hardening** (`src/lib/api.ts`):
  - Add `logout()`, `updateBoard()`, `updateSection()`, `deleteSection()`, `updateItem()`, `reorderItems()`, `reorderSections()`, `createDirectConversation` (exists), `searchPlaces` (`GET /places/search`), `getPresence` (`GET /chat/presence?userIds=`), `listComments` (`GET /boards/:boardId/comments`), `addComment`, `deleteComment`, `getSavedBoards` (backend new), `getMessages` with cursor param (already supports).
  - Fix `createItem` to send `{ type, sectionId, title, description, imageUrl, url, placeId, date }` and fix `updateItem` path (backend `@Patch('items/:itemId')` — drop the unused `:sectionId` from the mobile path or keep for typing only).
- **Socket client** (`src/lib/socket.ts`):
  - Rename chat events: emit `conversation:join`, listen `message:new`; emit `message:send` optionally.
  - Add `reconnection` config + exponential backoff; emit a heartbeat `ping` every 30s to refresh socket presence TTL.
  - Keep `board:*` events as-is (they already match `BoardsGateway`).
- **Toast/error component** (`src/components/ui/toast.tsx` + `src/hooks/use-toast.ts`): small overlay used by screens instead of silent catches.
- **Env:** ensure `mobile/.env` sets `EXPO_PUBLIC_API_URL` for device builds; document `.env.example` is sufficient.

Backend dependencies (Phase 0):
- Add `POST /auth/logout` client behavior — endpoint exists (`backend/src/auth/auth.controller.ts:75`); just call it.
- Add `GET /boards/saved` (returns `MyBoard[]`) in `BoardsController` + `BoardsService` reading `board_saves`.

---

## 3. Auth Completion

- **Google OAuth screen** (`src/app/(auth)/google-button.tsx` + add to `sign-in.tsx`/`sign-up.tsx`):
  - Use `expo-google-auth-session` with `responseType: 'id_token'` (or `access_token` if backend needs profiles). Capture `id_token`.
  - POST to `/auth/google/mobile` (backend new) with `{ idToken }`; save tokens via `useAuth`.
- **Backend:** `GET /auth/google` is redirect-based and web-only. Add `@Public() @Post('google/mobile')` in `AuthController` that verifies the Google `id_token` (via Google certs / `oauth2tokeninfo`), finds-or-creates the user, issues JWT pair. Flagged as backend task.
- **Logout** on `Settings` → `useAuth.signOut()`.

Files: `src/app/(auth)/sign-in.tsx`, `src/app/(auth)/sign-up.tsx`, new `src/app/(auth)/google-button.tsx`; backend `auth.controller.ts` + `auth.service.ts`.

---

## 4. Boards — Full Editor

### 4.1 Create / Edit board
- Extend `api.createBoard`/`updateBoard` payloads: `boardType`, `startDate`, `endDate`, `coverImageUrl`.
- New screen `src/app/board/edit.tsx` (or mode param on `create.tsx`).
- Cover upload: reuse `expo-image-picker` + `api.uploadImage` before submit; preview thumbnail.
- Date pickers: use `react-day-picker` web pattern? On mobile use native `DateTimePicker` (add `@react-native-community/datetimepicker` if not present — check deps; it's **not** in package.json, so add it).
- Visibility toggle + boardType selector (Itinerary vs Freeform).
- "Edit" button on `board/[id].tsx` header when `canEdit`, navigating here; invalidate `['board', id]` and socket `board:updated` will refetch.

Files: `src/app/board/create.tsx`, new `src/app/board/edit.tsx`, `src/lib/api.ts`, `src/lib/board-types.ts` (add `startDate/endDate/boardType` to `BoardDetail` if missing — currently missing).

### 4.2 Sections
- Add rename (edit icon on section header) → `api.updateSection`.
- Add delete (confirm alert) → `api.deleteSection`; socket `section:removed`.
- Reorder sections via `react-native-draggable-flatlist` → `api.reorderSections` on drag end with `orderedSectionIds`.
- The `BoardChangeEvent`/`applyBoardChange` already supports `sections:reordered` (add the case if missing — it's not in the switch; need to add it).

Files: `src/app/board/[id].tsx`, `src/lib/board-types.ts`.

### 4.3 Items
- Fix `createItem` payload (see §2 bugs). Add an item-type picker (PLACE/IMAGE/NOTE/LINK/RESTAURANT/HOTEL/ACTIVITY).
- **Place items:** integrate `api.searchPlaces` in the add-item flow; selecting a place sets `placeId` + `title`, and the backend item gets a `placeId`. Map the `PlaceResult.photoName` to a photo via `/places/photo` if exposed (backend doesn't expose a photo endpoint yet — add optional backend `GET /places/photo?photoName=...` or mark as future).
- **Image items:** image picker + `api.uploadImage`.
- **Date per item:** `DateTimePicker` for itinerary items.
- **Edit item:** small modal reusing `AddItemModal` inputs pre-filled, calling `api.updateItem`.
- **Delete item:** already present (silent) — surface errors via toast.
- **Drag reorder items within a section:** `react-native-draggable-flatlist`, on end → `api.reorderItems({ sectionId, orderedItemIds })`; optimistic via `applyBoardChange` local.
- **Move item between sections:** optional ("Could"); if implemented, drag to section header. Defer.

Files: `src/app/board/[id].tsx`, `src/lib/api.ts`, new `src/components/place-search.tsx`, `src/components/item-form.tsx`, `src/components/section-edit.tsx`.

### 4.4 Board detail polish
- Add a "Map" button when the board has place items with coordinates → `src/app/board/[id]/map.tsx`.
- Comments section: list (paginated), add, delete; subscribe to backend comment broadcasts if/when added (currently comments have no socket; REST-only is acceptable for MVP).

Files: new `src/app/board/[id]/map.tsx`, `src/app/board/[id]/comments.tsx` (or modal), `src/lib/api.ts`.

---

## 5. Discovery & Social

- **Explore search bar:** add a search field that refetches `api.getExplore(sort, limit, offset, q)`.
- **Following feed fix:** replace `api.getExplore('newest')` with a new `api.getFollowingFeed(limit, offset)` → `GET /explore/following`.
- **Saved boards:** add a "Saved" tab (filter) on `src/app/(tabs)/index.tsx` or a dedicated `src/app/(tabs)/saved.tsx` tab calling `GET /boards/saved`.
- **User search** already exists; keep.
- **Comments** API exists (`backend/src/comments/comments.controller.ts`); mobile client added in §4.4.
- **Share sheet** for board link: optional; use `expo-sharing` — defer unless trivial.

Backend: `GET /boards/saved` (BoardsController/BoardsService) + `GET /explore/following` route name already exists on controller.

---

## 6. Chat — Realtime Fix & Polish

- Fix socket events in `socket.ts` + `chat/[id].tsx`: emit `conversation:join`, listen `message:new`.
- Show `unreadCount` badge in conversation list.
- On opening a chat, emit `message:read` (socket) or call `POST /chat/conversations/:id/read`.
- Typing indicator: emit `message:typing` when input non-empty (debounced) and render "X is typing" from `user:typing`.
- Keep REST send as fallback (already does).
- Group DM creation UI: optional (skip for MVP; 1:1 DM from profile works).

Files: `src/lib/socket.ts`, `src/app/chat/[id].tsx`, `src/app/(tabs)/chat/index.tsx`, `src/lib/types.ts` (add `unreadCount` to conversation type).

---

## 7. Realtime Notes (Boards)

The existing `board/[id].tsx` realtime wiring is mostly correct. Ensure:
- Cleanup on `board:leave` when navigating away (already does).
- Optimistic local `applyBoardChange` for own mutations (e.g. create item → apply `item:created` immediately before refetch) to reduce flicker.
- Add `sections:reordered` handling in `applyBoardChange` (`board-types.ts`).

---

## 8. Validation & Quality Gates

- `pnpm lint` (`expo lint`) in `mobile/`.
- `pnpm build` (or `eas build --platform all` if EAS configured) for type-check; ensure `typedRoutes` satisfied (route names must match file names — new routes added must compile).
- Run `expo start` + Expo Go on iOS + Android simulators/emulators; smoke test auth → create board → add sections/items → realtime edit from a second device → chat.
- Verify no breaking API mismatches by comparing mobile `api.ts` calls against `backend/src/**/*.controller.ts` route paths + DTO shapes.
- Add a lightweight test: at minimum, a single unit test for `applyBoardChange` (`src/lib/board-types.spec.ts`) since `jest`/`ts-jest` is configured for backend; configure `jest-expo` for mobile optionally (deferred — not a hard gate).
- Lint must pass with no new warnings.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `react-native-draggable-flatlist` nested scroll inside `ScrollView` can be janky | Use a nested `FlatList` per section instead of `ScrollView` for items; keep sections in a vertical `FlatList`. |
| New native deps (`@react-native-community/datetimepicker`) require native build | Add via `npx expo install` (compat plugin included); if `expo-modules` not installed, use a pure-TS date picker fallback for web. |
| Google OAuth requires a backend token-exchange endpoint not yet built | Mark backend task explicitly; fallback: web-redirect `AuthSession` flow if no backend change allowed. |
| `expo-router/ui` import in `app-tabs.web.tsx` may not be installed | Verify `expo-router/ui` exists; if not, convert `app-tabs.web.tsx` to use the same `NativeTabs`-free `Tabs` API or delete stale web tabs. |
| Realtime chat currently broken due to event name drift | Fix is isolated to `socket.ts` + `chat/[id].tsx`; backend needs no change. |
| Saved boards endpoint missing | Add backend `GET /boards/saved`. |
| `createItem` sectionId mismatch | Fix client payload; no backend change. |

---

## 10. Open Questions (decisions to confirm before implementation)

1. **Google OAuth flow:** Should the backend add `POST /auth/google/mobile` (token exchange), or should mobile use a web-redirect `AuthSession` against the existing `/auth/google` flow? (Recommendation: token-exchange endpoint — cleaner native UX.)
2. **Saved boards:** Is a dedicated `/boards/saved` route acceptable, or should saved boards be served under `/users/me/saved`? (Recommendation: `/boards/saved`, consistent with `/boards/mine`.)
3. **Scope for this pass:** Confirm "Should"-level items (map view, comments, saved tab) are included; "Could/Won't" (AI, ads, push, offline-first) remain deferred.

---

## 11. High-Level Task Order

1. Foundation: auth store, route guard, toast, API client fixes, socket event fix.
2. Auth: logout, Google OAuth (+ backend token-exchange).
3. Boards editor: create/edit, cover upload, dates, section CRUD + reorder, item types/places/images/dates + edit + reorder.
4. Discovery: explore search, following feed fix, saved boards (+ backend `/boards/saved`).
5. Comments UI.
6. Chat polish: unread, read-on-open, typing.
7. Map view (optional).
8. Lint + typecheck + smoke on device.

