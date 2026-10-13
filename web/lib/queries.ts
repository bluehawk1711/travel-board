"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  fetchBoardMembers,
  fetchConversation,
  fetchConversations,
  fetchExploreFeed,
  fetchFollowingFeed,
  fetchMe,
  fetchMySettings,
  fetchNotifications,
  fetchPresence,
  fetchUnreadNotificationCount,
  listMessages,
  searchUsers,
  type BoardMember,
} from "@/lib/api";
import { fetchMyBoards, type MyBoard } from "@/lib/board-edit";
import { getAccessToken } from "@/lib/auth";
import type {
  AuthUser,
  ExploreResult,
  NotificationListResult,
  SearchUser,
  UserSettings,
} from "@/lib/types";

/** Centralized cache keys — keep invalidation consistent across the app. */
export const queryKeys = {
  myBoards: ["boards", "mine"] as const,
  board: (id: string) => ["board", id] as const,
  followingFeed: ["explore", "following"] as const,
  boardMembers: (boardId: string) => ["board", boardId, "members"] as const,
  me: ["me"] as const,
  mySettings: ["me", "settings"] as const,
  destinationOptions: ["explore", "destinations"] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  conversations: ["chat", "conversations"] as const,
  conversation: (id: string) => ["chat", "conversations", id] as const,
  messages: (conversationId: string, cursor?: number) =>
    ["chat", "messages", conversationId, cursor ?? "latest"] as const,
  presence: (userIds: string[]) => ["chat", "presence", ...userIds] as const,
  notifications: ["notifications", "list"] as const,
  unreadNotifications: ["notifications", "unread"] as const,
};

/**
 * Shared query options so imperative call sites (socket-driven components)
 * still route through the React Query cache. `fetchQuery` de-dupes concurrent
 * callers and reuses fresh entries.
 */
export const meQueryOptions = {
  queryKey: queryKeys.me,
  queryFn: async (): Promise<AuthUser> => (await fetchMe()).user,
};

export const conversationListQueryOptions = {
  queryKey: queryKeys.conversations,
  queryFn: fetchConversations,
  staleTime: 0,
};

export function conversationQueryOptions(id: string) {
  return {
    queryKey: queryKeys.conversation(id),
    queryFn: () => fetchConversation(id),
  };
}

export function messagesQueryOptions(conversationId: string, cursor?: number) {
  return {
    queryKey: queryKeys.messages(conversationId, cursor),
    queryFn: () => listMessages(conversationId, cursor),
  };
}

export function presenceQueryOptions(userIds: string[]) {
  return {
    queryKey: queryKeys.presence(userIds),
    queryFn: () => fetchPresence(userIds),
    staleTime: 15_000,
  };
}

/** Unique destinations from the newest public boards (autocomplete options). */
export function useDestinationOptions(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: queryKeys.destinationOptions,
    queryFn: async () => {
      const result = await fetchExploreFeed("newest", 50, 0);
      const seen = new Set<string>();
      for (const item of result.items) {
        if (item.destination) {
          seen.add(item.destination);
        }
      }
      return [...seen];
    },
    staleTime: 5 * 60_000,
  });
}

/** Current authenticated user (auth-only). */
export function useMe(): UseQueryResult<AuthUser> {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const { user } = await fetchMe();
      return user;
    },
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });
}

/** Boards I own or collaborate on (auth-only). */
export function useMyBoards(): UseQueryResult<MyBoard[]> {
  return useQuery({
    queryKey: queryKeys.myBoards,
    queryFn: fetchMyBoards,
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });
}

/** Boards from people I follow (auth-only, first page). */
export function useFollowingFeed(): UseQueryResult<ExploreResult> {
  return useQuery({
    queryKey: queryKeys.followingFeed,
    queryFn: () => fetchFollowingFeed(24, 0),
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });
}

/** Members of a board (auth-only). */
export function useBoardMembers(
  boardId: string,
): UseQueryResult<{ members: BoardMember[] }> {
  return useQuery({
    queryKey: queryKeys.boardMembers(boardId),
    queryFn: () => fetchBoardMembers(boardId),
    enabled: boardId.length > 0,
  });
}

/** My backend settings (theme/notifications/currency) — lazy-created server-side. */
export function useMySettings(): UseQueryResult<UserSettings> {
  return useQuery({
    queryKey: queryKeys.mySettings,
    queryFn: fetchMySettings,
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });
}

/** Debounced user search — pass a debounced query string. */
export function useUserSearch(q: string): UseQueryResult<{
  users: SearchUser[];
}> {
  return useQuery({
    queryKey: queryKeys.userSearch(q),
    queryFn: () => searchUsers(q),
    enabled: q.trim().length >= 1,
  });
}

/** Notification inbox (auth-only, first page). */
export function useNotifications(): UseQueryResult<NotificationListResult> {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotifications(30, 0),
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });
}

/** Unread badge count — polled lightly so the bell stays fresh. */
export function useUnreadNotificationCount(): UseQueryResult<number> {
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: async () =>
      (await fetchUnreadNotificationCount()).unreadCount,
    enabled: typeof window !== "undefined" && !!getAccessToken(),
    refetchInterval: 60_000,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return {
    invalidateMyBoards: () =>
      qc.invalidateQueries({ queryKey: queryKeys.myBoards }),
    invalidateFollowing: () =>
      qc.invalidateQueries({ queryKey: queryKeys.followingFeed }),
    invalidateBoard: (boardId: string) =>
      qc.invalidateQueries({ queryKey: ["board", boardId] }),
    invalidateSettings: () =>
      qc.invalidateQueries({ queryKey: queryKeys.mySettings }),
  };
}

export { useMutation };