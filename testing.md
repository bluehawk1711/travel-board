# API Testing

End-to-end smoke test covering every REST route in the NestJS API.

```bash
pnpm --dir backend db:seed     # load the demo dataset
pnpm --dir backend start:dev   # boot the API on :4000
pnpm --dir backend test:api    # run the suite and rewrite this file
```

The suite registers a throwaway account, walks every route, then deletes what it created, so it is safe to re-run. Set `API_URL` to target another host.

## Latest run

| | |
|---|---|
| Base URL | `http://localhost:4100` |
| Ran at | 2026-10-14T10:43:13.832Z |
| Node | v24.21.0 |
| **Result** | **75/75 passed** |

| Group | Checks | Passed |
|---|---|---|
| Health | 1 | 1 |
| Auth | 11 | 11 |
| Users | 6 | 6 |
| Boards | 26 | 26 |
| Comments | 4 | 4 |
| Chat | 8 | 8 |
| Discovery | 4 | 4 |
| Follows | 7 | 7 |
| Notifications | 3 | 3 |
| Push | 1 | 1 |
| Uploads | 3 | 3 |
| Places | 1 | 1 |

## Endpoint coverage

### Health

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | GET | `/` | 200 | API root responds |

### Auth

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | POST | `/auth/register` | 400 | Rejects an invalid registration payload |
| PASS | POST | `/auth/register` | 201 | Registers a new account and returns tokens |
| PASS | POST | `/auth/login` | 401 | Rejects a wrong password |
| PASS | POST | `/auth/login` | 400 | Rejects an empty login body |
| PASS | POST | `/auth/login` | 201 | Logs in with valid credentials |
| PASS | GET | `/auth/me` | 401 | Returns 401 without a token |
| PASS | GET | `/auth/me` | 200 | Returns the current user |
| PASS | POST | `/auth/refresh` | 201 | Rotates the refresh token |
| PASS | POST | `/auth/forgot-password` | 201 | Accepts a password reset request |
| PASS | POST | `/auth/register` | 201 | Registers a second account for the copy test |
| PASS | POST | `/auth/logout` | 201 | Logs out and revokes the refresh token |

### Users

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | GET | `/users/search?q=maya` | 200 | Searches users by name (auth required) |
| PASS | PATCH | `/users/me` | 200 | Updates the own profile |
| PASS | GET | `/users/me/settings` | 200 | Reads own settings |
| PASS | PATCH | `/users/me/settings` | 200 | Updates own settings |
| PASS | GET | `/users/11111111-1111-4111-8111-111111111111` | 200 | Reads a public profile |
| PASS | GET | `/users/11111111-1111-4111-8111-111111111111/boards` | 200 | Lists the public board grid of a user |

### Boards

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | POST | `/boards` | 201 | Creates a board |
| PASS | POST | `/boards` | 400 | Rejects a board with no title |
| PASS | GET | `/boards/mine` | 200 | Lists my boards (bare array) |
| PASS | GET | `/boards/saved` | 200 | Lists saved boards (bare array) |
| PASS | GET | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af` | 200 | Reads one board |
| PASS | PATCH | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af` | 200 | Updates the board |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/sections` | 201 | Adds a section |
| PASS | PATCH | `/boards/sections/209ddfbd-947a-4c4e-8e3d-53bdf469c9f8` | 200 | Renames the section |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/items` | 201 | Adds a place item to the section |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/items` | 400 | Rejects an item without sectionId |
| PASS | PATCH | `/boards/items/d74f5325-a3ac-41fd-8e34-4ea7816e74bc` | 200 | Updates the item |
| PASS | PATCH | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/items/reorder` | 200 | Reorders items within a section |
| PASS | DELETE | `/boards/items/d74f5325-a3ac-41fd-8e34-4ea7816e74bc` | 200 | Deletes the item |
| PASS | PATCH | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/sections/reorder` | 200 | Reorders sections |
| PASS | GET | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/members` | 200 | Lists members |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/members` | 201 | Adds a collaborator by email |
| PASS | PATCH | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/members/11111111-1111-4111-8111-111111111111` | 200 | Changes the collaborator role |
| PASS | DELETE | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/members/11111111-1111-4111-8111-111111111111` | 200 | Removes the collaborator |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/like` | 201 | Likes the board |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/like` | 201 | Un-likes the board |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/save` | 201 | Saves the board |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/save` | 201 | Un-saves the board |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/copy` | 201 | Copies a public board into my boards (starts private) |
| PASS | PATCH | `/boards/6578fddb-23ae-4dec-939c-8892503dc360` | 200 | Edits the copied board (owner can modify their copy) |
| PASS | DELETE | `/boards/6578fddb-23ae-4dec-939c-8892503dc360` | 200 | Deletes the copied board (cleanup) |
| PASS | DELETE | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af` | 200 | Deletes the board |

### Comments

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/comments` | 201 | Adds a comment |
| PASS | GET | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/comments` | 200 | Lists comments on a board |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/comments` | 400 | Rejects an empty comment |
| PASS | DELETE | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/comments/f324ae98-73c4-4b2a-b892-0a670cfc9f18` | 200 | Deletes the comment |

### Chat

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | GET | `/chat/boards/1febfb4f-583a-4860-a3f9-4362679f62af` | 200 | Opens (or creates) the board chat room |
| PASS | GET | `/chat/conversations/c099d116-147b-4eea-8902-38f74f8ffd3c` | 200 | Reads the conversation detail |
| PASS | GET | `/chat/conversations/c099d116-147b-4eea-8902-38f74f8ffd3c/messages` | 200 | Lists messages (first cursor page) |
| PASS | POST | `/chat/conversations/c099d116-147b-4eea-8902-38f74f8ffd3c/messages` | 201 | Sends a message |
| PASS | POST | `/chat/conversations/c099d116-147b-4eea-8902-38f74f8ffd3c/read` | 201 | Marks the room read |
| PASS | GET | `/chat/presence` | 200 | Reads the presence map |
| PASS | GET | `/chat/conversations` | 200 | Lists conversations |
| PASS | POST | `/chat/conversations` | 201 | Creates a direct conversation |

### Discovery

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | GET | `/explore` | 200 | Public explore feed (newest) |
| PASS | GET | `/explore?sort=trending` | 200 | Explore feed sorted by trending |
| PASS | GET | `/explore?q=Japan` | 200 | Searches the explore feed |
| PASS | GET | `/explore/following` | 200 | Following feed |

### Follows

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | POST | `/users/11111111-1111-4111-8111-111111111111/follow` | 201 | Follows a user |
| PASS | GET | `/users/11111111-1111-4111-8111-111111111111/followers` | 200 | Lists the followers of a user |
| PASS | GET | `/users/11111111-1111-4111-8111-111111111111/following` | 200 | Lists who a user follows |
| PASS | DELETE | `/users/11111111-1111-4111-8111-111111111111/follow` | 200 | Unfollows the user |
| PASS | POST | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/follow` | 201 | Follows a board |
| PASS | GET | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/followers` | 200 | Lists the followers of a board |
| PASS | DELETE | `/boards/1febfb4f-583a-4860-a3f9-4362679f62af/follow` | 200 | Unfollows the board |

### Notifications

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | GET | `/notifications` | 200 | Lists notifications |
| PASS | GET | `/notifications/unread-count` | 200 | Reads the unread count |
| PASS | PATCH | `/notifications/read-all` | 200 | Marks all notifications read |

### Push

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | POST | `/push/tokens` | 201 | Registers a push token |

### Uploads

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | POST | `/uploads/image` | 201 | Multipart image upload returns { url } |
| PASS | GET | `/uploads/e871e453-8fd9-4c74-9374-6ccbdbb476e8.png` | 200 | Uploaded file is served from /uploads |
| PASS | POST | `/uploads/image` | 400 | Rejects a non-image mime type |

### Places

| Result | Method | Path | Status | Checks |
|---|---|---|---|---|
| PASS | GET | `/places/search?q=ramen%20in%20tokyo` | 502 | Proxies Google Places search (needs a valid server API key) |

## Notes

- `GET /places/search` requires a valid `GOOGLE_PLACES_API_KEY` in `backend/.env`. A missing key answers 500 and a placeholder key gets `400 API key not valid` from Google, which the proxy maps to 502; both are expected until a real key is configured.
- `POST /uploads/image` is exercised with a real multipart body (1x1 PNG); a non-image mime type is rejected with 400 and the stored file is fetched back from `/uploads/<filename>`.
- Socket.IO events (`conversation:join`, `message:new`, `message:read`, `user:typing`) are exercised by the web and mobile clients, not by this REST suite.
- Google OAuth (`GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/mobile`) needs a Google Cloud client; it is not covered here.

