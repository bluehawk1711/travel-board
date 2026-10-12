/** Mirror of backend `DiscoveryService.FeedItem`. */
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
  startDate: string | null;
  endDate: string | null;
}

export interface ExploreResult {
  items: FeedItem[];
  hasMore: boolean;
}

export type FeedSort = 'newest' | 'trending';

/** Board row from `GET /boards/mine` (board + role/memberCount/itemCount/likeCount). */
export interface MyBoard {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  destination: string | null;
  boardType: 'ITINERARY' | 'FREEFORM';
  visibility: 'PUBLIC' | 'PRIVATE';
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  memberCount: number;
  itemCount: number;
  likeCount: number;
}

/** Sanitized user shape from the API (never contains passwordHash). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface SearchUser {
  id: string;
  name: string;
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

export interface BoardMember {
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  location: { lat: number; lng: number } | null;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  photoName: string | null;
}

export interface CommentItem {
  id: string;
  boardId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

export interface CommentListResult {
  items: CommentItem[];
  total: number;
}

export interface ConversationMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'BOARD';
  name: string | null;
  lastMessage?: { body: string; createdAt: string } | null;
  members: ConversationMember[];
  unreadCount?: number;
}

// ── Notifications ─────────────────────────────────────────────

export type NotificationType =
  | 'NEW_FOLLOWER'
  | 'NEW_BOARD_FOLLOWER'
  | 'NEW_COMMENT'
  | 'NEW_LIKE'
  | 'NEW_SAVE'
  | 'NEW_CHAT_MESSAGE'
  | 'MENTION';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: { id: string; name: string; avatarUrl: string | null };
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  total: number;
}
