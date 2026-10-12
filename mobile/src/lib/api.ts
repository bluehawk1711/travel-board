import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { BoardDetail } from './board-types';
import type {
  AuthUser,
  BoardMember,
  CommentItem,
  CommentListResult,
  ConversationSummary,
  ExploreResult,
  FeedSort,
  FollowListResult,
  MyBoard,
  NotificationListResult,
  PlaceResult,
  PublicProfile,
  SearchUser,
  TokensResponse,
  UserBoardsResult,
} from './types';
import type { UserSettings } from '@travel-board/shared';

/**
 * NestJS API base URL. Set `EXPO_PUBLIC_API_URL` in `mobile/.env` (see
 * `.env.example`); defaults to the local backend for simulators/web.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// expo-secure-store has no web support — fall back to in-memory on web.
const memoryTokens: Record<string, string | null> = {};

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryTokens[key] ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryTokens[key] = value;
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    delete memoryTokens[key];
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await removeItem(ACCESS_TOKEN_KEY);
  await removeItem(REFRESH_TOKEN_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Deduplicates concurrent calls — all callers share the same promise.
 * Returns the new access token on success, or null on failure (caller
 * should redirect to login).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await clearTokens();
        return null;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await saveTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      await clearTokens();
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(`${API_URL}${path}`, { ...init, headers });

  // If 401 and we have a refresh token, try refreshing and retry once.
  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(`${API_URL}${path}`, { ...init, headers });
    }
  }

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // non-JSON error body — fall through
  }
  return `Request failed (${response.status})`;
}

// ── Auth ────────────────────────────────────────────────────

export const api = {
  register(
    name: string,
    email: string,
    password: string,
  ): Promise<TokensResponse> {
    return apiFetch<TokensResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  login(email: string, password: string): Promise<TokensResponse> {
    return apiFetch<TokensResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(): Promise<{ user: AuthUser }> {
    return apiFetch<{ user: AuthUser }>('/auth/me');
  },

  forgotPassword(email: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(
    token: string,
    password: string,
  ): Promise<TokensResponse> {
    return apiFetch<TokensResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  googleMobile(idToken: string): Promise<TokensResponse> {
    return apiFetch<TokensResponse>('/auth/google/mobile', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  async logout(): Promise<{ success: true }> {
    return apiFetch<{ success: true }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: await getRefreshToken() }),
    });
  },

  // ── Explore ────────────────────────────────────────────────

  getExplore(
    sort: FeedSort,
    limit: number,
    offset: number,
    q?: string,
  ): Promise<ExploreResult> {
    let url = `/explore?sort=${sort}&limit=${limit}&offset=${offset}`;
    if (q) {
      url += `&q=${encodeURIComponent(q)}`;
    }
    return apiFetch<ExploreResult>(url);
  },

  getFollowingFeed(limit: number, offset: number): Promise<ExploreResult> {
    return apiFetch<ExploreResult>(
      `/explore/following?limit=${limit}&offset=${offset}`,
    );
  },

  searchPlaces(
    q: string,
    lat?: number,
    lng?: number,
    radius?: number,
  ): Promise<PlaceResult[]> {
    let url = `/places/search?q=${encodeURIComponent(q)}`;
    if (lat != null && lng != null) {
      url += `&lat=${lat}&lng=${lng}`;
      if (radius != null) url += `&radius=${radius}`;
    }
    return apiFetch<PlaceResult[]>(url);
  },

  // ── Boards ─────────────────────────────────────────────────

  getMyBoards(): Promise<MyBoard[]> {
    return apiFetch<MyBoard[]>('/boards/mine');
  },

  getSavedBoards(): Promise<MyBoard[]> {
    return apiFetch<MyBoard[]>('/boards/saved');
  },

  getBoard(id: string): Promise<BoardDetail> {
    return apiFetch<BoardDetail>(`/boards/${id}`);
  },

  listComments(
    boardId: string,
    limit = 50,
    offset = 0,
  ): Promise<CommentListResult> {
    return apiFetch<CommentListResult>(
      `/boards/${boardId}/comments?limit=${limit}&offset=${offset}`,
    );
  },

  addComment(boardId: string, body: string): Promise<CommentItem> {
    return apiFetch<CommentItem>(`/boards/${boardId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  deleteComment(
    boardId: string,
    commentId: string,
  ): Promise<{ deleted: boolean }> {
    return apiFetch<{ deleted: boolean }>(
      `/boards/${boardId}/comments/${commentId}`,
      { method: 'DELETE' },
    );
  },

  createBoard(payload: {
    title: string;
    destination?: string;
    description?: string;
    visibility?: 'PUBLIC' | 'PRIVATE';
    boardType?: 'ITINERARY' | 'FREEFORM';
    startDate?: string;
    endDate?: string;
    coverImageUrl?: string;
  }): Promise<MyBoard> {
    return apiFetch<MyBoard>('/boards', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateBoard(
    id: string,
    payload: {
      title?: string;
      destination?: string;
      description?: string;
      coverImageUrl?: string;
      visibility?: 'PUBLIC' | 'PRIVATE';
      boardType?: 'ITINERARY' | 'FREEFORM';
      startDate?: string;
      endDate?: string;
    },
  ): Promise<MyBoard> {
    return apiFetch<MyBoard>(`/boards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteBoard(id: string): Promise<{ deleted: boolean }> {
    return apiFetch<{ deleted: boolean }>(`/boards/${id}`, {
      method: 'DELETE',
    });
  },

  // ── Board sections & items ─────────────────────────────────

  createSection(
    boardId: string,
    title: string,
  ): Promise<{ section: { id: string; title: string; position: number } }> {
    return apiFetch(`/boards/${boardId}/sections`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  updateSection(
    boardId: string,
    sectionId: string,
    payload: { title?: string; position?: number },
  ): Promise<{ section: { id: string; title: string; position: number } }> {
    return apiFetch(`/boards/sections/${sectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteSection(boardId: string, sectionId: string): Promise<{ deleted: boolean }> {
    return apiFetch(`/boards/sections/${sectionId}`, {
      method: 'DELETE',
    });
  },

  reorderSections(
    boardId: string,
    orderedSectionIds: string[],
  ): Promise<{ reordered: boolean }> {
    return apiFetch(`/boards/${boardId}/sections/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedSectionIds }),
    });
  },

  createItem(
    boardId: string,
    sectionId: string,
    payload: {
      type: 'PLACE' | 'IMAGE' | 'NOTE' | 'LINK' | 'RESTAURANT' | 'HOTEL' | 'ACTIVITY';
      title: string;
      description?: string;
      imageUrl?: string;
      url?: string;
      placeId?: string;
      date?: string;
      position?: number;
      lat?: number;
      lng?: number;
    },
  ): Promise<{ item: { id: string; title: string } }> {
    return apiFetch(`/boards/${boardId}/items`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, sectionId }),
    });
  },

  updateItem(
    boardId: string,
    sectionId: string,
    itemId: string,
    payload: {
      title?: string;
      description?: string;
      imageUrl?: string;
      url?: string;
      placeId?: string;
      date?: string;
      position?: number;
      lat?: number;
      lng?: number;
    },
  ): Promise<{ item: { id: string; title: string } }> {
    return apiFetch(`/boards/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteItem(
    boardId: string,
    sectionId: string,
    itemId: string,
  ): Promise<{ deleted: boolean }> {
    return apiFetch(`/boards/items/${itemId}`, { method: 'DELETE' });
  },

  reorderItems(
    boardId: string,
    sectionId: string,
    orderedItemIds: string[],
  ): Promise<{ reordered: boolean }> {
    return apiFetch(`/boards/${boardId}/items/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ sectionId, orderedItemIds }),
    });
  },

  // ── Likes & saves ──────────────────────────────────────────

  toggleBoardLike(
    id: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    return apiFetch(`/boards/${id}/like`, { method: 'POST' });
  },

  toggleBoardSave(
    id: string,
  ): Promise<{ saved: boolean; saveCount: number }> {
    return apiFetch(`/boards/${id}/save`, { method: 'POST' });
  },

  // ── Board members ──────────────────────────────────────────

  getBoardMembers(boardId: string): Promise<BoardMember[]> {
    return apiFetch(`/boards/${boardId}/members`);
  },

  addBoardMember(
    boardId: string,
    email: string,
    role: 'EDITOR' | 'VIEWER' = 'VIEWER',
  ): Promise<{ member: BoardMember }> {
    return apiFetch(`/boards/${boardId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  updateBoardMemberRole(
    boardId: string,
    userId: string,
    role: 'EDITOR' | 'VIEWER',
  ): Promise<{ updated: boolean }> {
    return apiFetch(`/boards/${boardId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  removeBoardMember(
    boardId: string,
    userId: string,
  ): Promise<{ removed: boolean }> {
    return apiFetch(`/boards/${boardId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  // ── Users & profiles ───────────────────────────────────────

  searchUsers(q: string): Promise<{ users: SearchUser[] }> {
    return apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
  },

  getProfile(id: string): Promise<{ user: PublicProfile }> {
    return apiFetch(`/users/${id}`);
  },

  getUserBoards(
    id: string,
    limit: number,
    offset: number,
  ): Promise<UserBoardsResult> {
    return apiFetch(
      `/users/${id}/boards?limit=${limit}&offset=${offset}`,
    );
  },

  updateMyProfile(payload: {
    name?: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<{ user: AuthUser }> {
    return apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  toggleFollowUser(
    userId: string,
    following: boolean,
  ): Promise<{ following: boolean; followerCount: number }> {
    return apiFetch(`/users/${userId}/follow`, {
      method: following ? 'DELETE' : 'POST',
    });
  },

  getUserFollowers(
    userId: string,
  ): Promise<FollowListResult<SearchUser>> {
    return apiFetch(`/users/${userId}/followers`);
  },

  getUserFollowing(
    userId: string,
  ): Promise<FollowListResult<SearchUser>> {
    return apiFetch(`/users/${userId}/following`);
  },

  // ── Uploads ────────────────────────────────────────────────

  async uploadImage(file: { uri: string; name: string; type: string }): Promise<{ url: string }> {
    const token = await getAccessToken();
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Note: Don't set Content-Type — let the runtime set it for multipart.
    const response = await fetch(`${API_URL}/uploads/image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new ApiError(
        await extractErrorMessage(response),
        response.status,
      );
    }
    const data = (await response.json()) as { url: string };
    // The API returns root-relative URLs (/uploads/<file>) — make them
    // absolute so <Image>/avatars/covers resolve against the backend host.
    return {
      url: data.url.startsWith('/') ? `${API_URL}${data.url}` : data.url,
    };
  },

  // ── Settings (backend/src/users, `user_settings` table) ─────

  getSettings(): Promise<UserSettings> {
    return apiFetch<UserSettings>('/users/me/settings');
  },

  updateSettings(
    patch: Partial<
      Pick<
        UserSettings,
        'themeMode' | 'notificationsEnabled' | 'emailUpdates' | 'currency'
      >
    >,
  ): Promise<UserSettings> {
    return apiFetch<UserSettings>('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // ── Chat ───────────────────────────────────────────────────

  getConversations(): Promise<ConversationSummary[]> {
    return apiFetch<ConversationSummary[]>('/chat/conversations');
  },

  markConversationRead(conversationId: string, lastMessageId: number) {
    return apiFetch<{ ok: boolean }>(
      `/chat/conversations/${conversationId}/read`,
      {
        method: 'POST',
        body: JSON.stringify({ lastMessageId }),
      },
    );
  },

  getConversation(conversationId: string) {
    return apiFetch<{
      id: string;
      type: string;
      name: string | null;
      members: { userId: string; name: string; avatarUrl: string | null }[];
    }>(`/chat/conversations/${conversationId}`);
  },

  getMessages(conversationId: string, cursor?: number) {
    let url = `/chat/conversations/${conversationId}/messages`;
    if (cursor != null) {
      url += `?cursor=${cursor}`;
    }
    return apiFetch<{
      items: {
        id: string;
        body: string;
        senderId: string;
        createdAt: string;
      }[];
      nextCursor: number | null;
    }>(url);
  },

  sendMessage(conversationId: string, body: string) {
    return apiFetch<{
      id: string;
      body: string;
      senderId: string;
      createdAt: string;
    }>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  getBoardConversation(boardId: string) {
    return apiFetch<{
      id: string;
      type: string;
      name: string | null;
      members: { userId: string; name: string; avatarUrl: string | null }[];
    }>(`/chat/boards/${boardId}`);
  },

  createDirectConversation(userId: string) {
    return apiFetch<{
      id: string;
      type: string;
      name: string | null;
      members: { userId: string; user: { id: string; name: string; avatarUrl: string | null } }[];
    }>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'DIRECT', userId }),
    });
  },

  getPresence(userIds: string[]): Promise<Record<string, boolean>> {
    return apiFetch<Record<string, boolean>>(
      `/chat/presence?userIds=${encodeURIComponent(userIds.join(','))}`,
    );
  },

  // ── Notifications ──────────────────────────────────────────

  getNotifications(limit: number, offset: number): Promise<NotificationListResult> {
    return apiFetch<NotificationListResult>(
      `/notifications?limit=${limit}&offset=${offset}`,
    );
  },

  getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
    return apiFetch<{ unreadCount: number }>('/notifications/unread-count');
  },

  markNotificationsRead(ids: string[]): Promise<{ updated: number }> {
    return apiFetch<{ updated: number }>('/notifications/read', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    });
  },

  markAllNotificationsRead(): Promise<{ updated: number }> {
    return apiFetch<{ updated: number }>('/notifications/read-all', {
      method: 'PATCH',
    });
  },

  // ── Push ───────────────────────────────────────────────────

  registerPushToken(payload: {
    token: string;
    platform?: 'EXPO' | 'FCM' | 'WEB_PUSH';
  }): Promise<{ registered: boolean }> {
    return apiFetch<{ registered: boolean }>('/push/tokens', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  unregisterPushToken(token: string): Promise<{ unregistered: boolean }> {
    return apiFetch<{ unregistered: boolean }>('/push/tokens', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  },
};
