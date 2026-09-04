# Travel Board App — Features

Prioritized using MoSCoW: **Must** (MVP, can't launch without), **Should** (important, soon after launch), **Could** (nice to have, later), **Won't** (explicitly out of scope for now).

---

## 1. Authentication & Profile

| Feature | Priority |
|---|---|
| Email/password signup & login | Must |
| Google OAuth login | Must |
| User profile (name, avatar, bio) | Must |
| Edit profile | Must |
| Password reset | Must |
| Other social logins (Apple, Facebook) | Could |
| Two-factor auth | Won't (v1) |

## 2. Travel Boards (core)

| Feature | Priority |
|---|---|
| Create board (title, description, destination, dates) | Must |
| Cover image upload | Must |
| Public / private visibility toggle | Must |
| Edit / delete board | Must |
| Add sections (e.g. "Day 1", or freeform groups) | Must |
| Add items to a section (place, image, note, link) | Must |
| Item types: restaurant, hotel, activity | Should |
| Reorder items within a section (drag & drop) | Must |
| Reorder sections (e.g. reorder days) | Should |
| Move item between sections (drag across) | Could |
| Board templates (e.g. pre-built "Japan 7-day" skeleton) | Could |
| Duplicate/clone a board | Could |
| Board version history / undo | Won't (v1) |

## 3. Discovery (Pinterest-style feed)

| Feature | Priority |
|---|---|
| Explore feed — masonry grid of public boards | Must |
| Board detail view | Must |
| Search boards by destination/title | Must |
| Filter/sort feed (trending, newest, by destination) | Should |
| Search places/items across boards | Could |
| Personalized feed (based on follows/likes) | Could |

## 4. Save / Bookmark

| Feature | Priority |
|---|---|
| Save a board to "my boards" | Must |
| Save an individual item into one of my boards | Should |
| "Save to..." picker with create-new-board inline | Must |
| Collections/folders of saved boards | Could |

## 5. Social

| Feature | Priority |
|---|---|
| Like a board | Must |
| Comment on a board | Should |
| Follow a user | Should |
| Follow a board | Could |
| Following feed | Should |
| Share board (public link) | Must |
| Share to external apps (WhatsApp, Instagram, etc.) | Should |
| Notifications (likes, comments, follows, invites) | Should |

## 6. Collaboration

| Feature | Priority |
|---|---|
| Invite users to a board | Must |
| Roles: Owner / Editor / Viewer | Must |
| Permission-based edit/reorder/delete | Must |
| See who's on a board (member list) | Must |
| Real-time or near-real-time sync of edits | Should |
| Activity log (who added/changed what) | Could |
| @mentions / comments on specific items | Could |

## 7. Places & Trip Data

| Feature | Priority |
|---|---|
| Google Places search (add a real place to a board) | Must |
| Map view of a board's places | Should |
| Manual place entry (no Google Places match) | Must |
| Trip dates on board | Must |
| Per-item date/time (for itinerary boards) | Should |
| Budget tracking per trip | Could |
| Weather info for destination/dates | Won't (v1) |

## 8. AI "Build My Trip" (differentiator)

| Feature | Priority |
|---|---|
| Generate draft itinerary from destination + days + budget + style | Should (fast-follow, not blocking MVP) |
| User can edit AI-generated board like any other board | Should |
| Regenerate / refine specific days | Could |

## 9. Monetization

| Feature | Priority |
|---|---|
| Google AdSense placement (web, explore/discovery only) | Should |
| Premium tier (no ads, advanced features) | Could |
| PDF export of itinerary | Could |
| Mobile ad network integration (AdMob or similar) | Could |
| Sponsored board placements | Won't (v1) |

## 10. Platform / Technical

| Feature | Priority |
|---|---|
| Web app (Next.js) | Must |
| Mobile app — iOS & Android (React Native/Expo) | Must |
| Image upload & storage (Cloudflare R2/S3) | Must |
| Push notifications (mobile) | Should |
| Offline support / caching | Could |
| Play Store & App Store listing, compliance | Must |

---

## MVP Cut Line (what "must launch with" actually looks like)

**Ship with:**
Auth (email + Google) → create/edit board → sections → items (place/image/note/link) → drag-to-reorder within a section → public/private → explore feed (masonry) → save a board → like → share link → invite collaborators with roles → manual + Google Places search for places → basic map view.

**Deliberately deferred:**
AI trip builder, monetization (ads/premium), comments/notifications, real-time sync, PDF export, budget tracking.

This keeps the first Play Store release focused on the core loop — *create a board, make it visual, share it, let people save and collaborate on it* — without the complexity of AI generation or ad integration slowing down launch.