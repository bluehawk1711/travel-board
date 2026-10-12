/** Mirrors backend `DiscoveryService.FeedItem` (backend/src/discovery/discovery.service.ts). */
export interface FeedItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: string;
  itemCount: number;
  likeCount: number;
  saveCount: number;
  owner: { id: string; name: string; avatarUrl: string | null };
  createdAt: string;
  /** Trip window (nullable) — lets clients filter itineraries by date range. */
  startDate: string | null;
  endDate: string | null;
}

export interface ExploreResult {
  items: FeedItem[];
  hasMore: boolean;
}

export type FeedSort = 'newest' | 'trending';

/** Sanitized user shape from `GET /auth/me` (never contains passwordHash). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

/** Re-exported from the shared brand module (single source of truth). */
export type { UserSettings, ThemeMode } from '@travel-board/shared';

export interface SearchUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  publicBoardCount: number;
  /** null = anonymous viewer; false/true = signed-in viewer. */
  isFollowing: boolean | null;
  isMe: boolean;
}

export interface UserBoardFeedItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: string;
  itemCount: number;
  likeCount: number;
  saveCount: number;
  createdAt: string;
}

export interface UserBoardsResult {
  items: UserBoardFeedItem[];
  hasMore: boolean;
}

export interface FollowListResult<T> {
  items: T[];
  total: number;
}