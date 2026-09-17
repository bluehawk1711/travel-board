import { getAccessToken, refreshAccessToken } from './auth';
import type { BoardDetail } from './board-types';
import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  MessagePage,
} from './chat-types';
import type {
  AuthUser,
  ExploreResult,
  FeedSort,
  FollowListResult,
  PublicProfile,
  SearchUser,
  UserBoardsResult,
} from './types';
import type { UserSettings } from '@shared';

/**
 * NestJS API base URL. Set `NEXT_PUBLIC_API_URL` in `web/.env.local`
 * (see `.env.example`); defaults to the local backend.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Page size passed to `GET /explore` (API clamps to 50). */
export const FEED_PAGE_SIZE = 20;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      message = body.message.join(', ');
    } else if (typeof body.message === 'string') {
      message = body.message;
    }
  } catch {
    // non-JSON error body — keep the generic message
  }
  throw new ApiError(message, response.status);
}

export async function fetchExploreFeed(
  sort: FeedSort,
  limit: number,
  offset: number,
  q?: string,
): Promise<ExploreResult> {
  const url = new URL('/explore', API_URL);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (q) {
    url.searchParams.set('q', q);
  }

  // No caching here — the API serves its own 60s Redis-cached feed
  // (architecture.md §5.4), so each request is cheap and fresh enough.
  const response = await fetch(url);
  return parseResponse<ExploreResult>(response);
}

/** Boards from the users I follow (auth-only). */
export function fetchFollowingFeed(
  limit: number,
  offset: number,
): Promise<ExploreResult> {
  const url = new URL('/explore/following', API_URL);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return authFetch(url.pathname + url.search);
}

/**
 * Board detail. Works server-side (page) and client-side (live refetch);
 * the API itself caches public board reads for 60s.
 */
export async function fetchBoard(id: string): Promise<BoardDetail> {
  const response = await fetch(new URL(`/boards/${id}`, API_URL));
  return parseResponse<BoardDetail>(response);
}

/**
 * Authenticated fetch for client-only calls (like/save/chat/edit). Reads the
 * JWT from memory; anonymous users get a 401 ApiError which callers
 * handle. Automatically retries once on 401 after refreshing the token.
 */
export async function authFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (init?.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(new URL(path, API_URL), {
    ...init,
    headers,
    credentials: 'include', // send httpOnly cookies for refresh endpoint
  });

  // If 401 and we have a token, try refreshing and retry once.
  if (response.status === 401 && getAccessToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      const retry = await fetch(new URL(path, API_URL), {
        ...init,
        headers,
        credentials: 'include',
      });
      return parseResponse<T>(retry);
    }
  }

  return parseResponse<T>(response);
}

// ── Likes & saves ─────────────────────────────────────────────

export function toggleBoardLike(
  id: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return authFetch(`/boards/${id}/like`, { method: 'POST' });
}

export function toggleBoardSave(
  id: string,
): Promise<{ saved: boolean; saveCount: number }> {
  return authFetch(`/boards/${id}/save`, { method: 'POST' });
}

// ── Board chat (backend/src/chat) ─────────────────────────────

/** Get-or-create the per-board collaboration room (board members only). */
export function getBoardConversation(
  boardId: string,
): Promise<ConversationDetail> {
  return authFetch(`/chat/boards/${boardId}`);
}

export function listMessages(
  conversationId: string,
  cursor?: number,
): Promise<MessagePage> {
  const url = new URL(
    `/chat/conversations/${conversationId}/messages`,
    API_URL,
  );
  if (cursor) {
    url.searchParams.set('cursor', String(cursor));
  }
  return authFetch(url.pathname + url.search);
}

export function sendChatMessage(
  conversationId: string,
  body: string,
): Promise<ChatMessage> {
  return authFetch(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

/** Current user (for aligning chat bubbles as mine/theirs). */
export function fetchMe(): Promise<{ user: AuthUser }> {
  return authFetch('/auth/me');
}

// ── Users & profiles (backend/src/users, /follows) ──────────

export function fetchProfile(
  id: string,
): Promise<{ user: PublicProfile }> {
  return authFetch(`/users/${id}`);
}

export function fetchUserBoards(
  id: string,
  limit: number,
  offset: number,
): Promise<UserBoardsResult> {
  const url = new URL(`/users/${id}/boards`, API_URL);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return authFetch(url.pathname + url.search);
}

export function updateMyProfile(payload: {
  name?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<{ user: AuthUser }> {
  return authFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ── User settings (backend/src/users, `user_settings` table) ──

export function fetchMySettings(): Promise<UserSettings> {
  return authFetch('/users/me/settings');
}

export function updateMySettings(
  payload: Partial<Pick<UserSettings, 'themeMode' | 'notificationsEnabled' | 'emailUpdates' | 'currency'>>,
): Promise<UserSettings> {
  return authFetch('/users/me/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function toggleFollowUser(
  userId: string,
  following: boolean,
): Promise<{ following: boolean; followerCount: number }> {
  return authFetch(`/users/${userId}/follow`, {
    method: following ? 'DELETE' : 'POST',
  });
}

export function fetchUserFollowers(
  userId: string,
): Promise<FollowListResult<SearchUser>> {
  return authFetch(`/users/${userId}/followers`);
}

export function fetchUserFollowing(
  userId: string,
): Promise<FollowListResult<SearchUser>> {
  return authFetch(`/users/${userId}/following`);
}

// ── Uploads (backend/src/uploads) ──────────────────────────

/** Upload an image (≤5MB, jpeg/png/webp/gif) → public `/uploads/...` URL. */
export function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  return authFetch('/uploads/image', { method: 'POST', body: form });
}

// ── Chat: conversations & users (backend/src/chat, /users) ─

export function fetchConversations(): Promise<ConversationSummary[]> {
  return authFetch('/chat/conversations');
}

export function fetchConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  return authFetch(`/chat/conversations/${conversationId}`);
}

export function searchUsers(q: string): Promise<{ users: SearchUser[] }> {
  const url = new URL('/users/search', API_URL);
  url.searchParams.set('q', q);
  return authFetch(url.pathname + url.search);
}

export function createDirectConversation(
  userId: string,
): Promise<ConversationDetail> {
  return authFetch('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ type: 'DIRECT', userId }),
  });
}

export function createGroupConversation(
  name: string | null,
  memberIds: string[],
): Promise<ConversationDetail> {
  return authFetch('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ type: 'GROUP', name, memberIds }),
  });
}

// ── Board members ──────────────────────────────────────

export interface BoardMember {
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export function fetchBoardMembers(boardId: string): Promise<{ members: BoardMember[] }> {
  return authFetch(`/boards/${boardId}/members`);
}

export function addBoardMember(
  boardId: string,
  email: string,
  role: 'EDITOR' | 'VIEWER' = 'VIEWER',
): Promise<{ member: BoardMember }> {
  return authFetch(`/boards/${boardId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export function updateBoardMemberRole(
  boardId: string,
  userId: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<{ updated: boolean }> {
  return authFetch(`/boards/${boardId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeBoardMember(
  boardId: string,
  userId: string,
): Promise<{ removed: boolean }> {
  return authFetch(`/boards/${boardId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export function deleteBoard(boardId: string): Promise<{ deleted: boolean }> {
  return authFetch(`/boards/${boardId}`, { method: 'DELETE' });
}

// ── Password reset ────────────────────────────────────

export function forgotPassword(
  email: string,
): Promise<{ success: boolean }> {
  return fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then((r) => parseResponse<{ success: boolean }>(r));
}

export function resetPassword(
  token: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  }).then((r) => parseResponse<{ accessToken: string; refreshToken: string }>(r));
}

// ── Presence (chat) ─────────────────────────────────────

/** Presence lookup for the active conversation's members. */
export function fetchPresence(
  userIds: string[],
): Promise<Record<string, boolean>> {
  const url = new URL('/chat/presence', API_URL);
  url.searchParams.set('userIds', userIds.join(','));
  return authFetch(url.pathname + url.search);
}