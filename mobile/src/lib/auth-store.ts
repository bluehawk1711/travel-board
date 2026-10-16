import { create } from 'zustand';

import {
  ApiError,
  api,
  clearTokens,
  getAccessToken,
  saveTokens,
} from './api';
import { queryClient } from './query-client';
import { disconnectSocket } from './socket';
import type { AuthUser, TokensResponse } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Warm the queries the home screen needs the moment a session is established.
 * We seed `me` straight from the login response (the user object is already
 * there — no round-trip) and prefetch the default feed + unread badge in the
 * background so the tabs render from cache instead of showing a spinner.
 */
async function prefetchHomeData(user: AuthUser): Promise<void> {
  queryClient.setQueryData(['me'], { user });
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['unreadNotifications'],
      queryFn: api.getUnreadNotificationCount,
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: ['home', 'foryou', ''],
      queryFn: ({ pageParam }) =>
        api.getExplore('newest', 20, (pageParam as number) ?? 0),
      initialPageParam: 0,
    }),
  ]);
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  hydrate: () => Promise<void>;
  setSession: (tokens: TokensResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  hydrate: async () => {
    const token = await getAccessToken();
    if (!token) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    try {
      const { user } = await api.me();
      set({ status: 'authenticated', user });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearTokens();
      }
      set({ status: 'unauthenticated', user: null });
    }
  },
  setSession: async (tokens) => {
    await saveTokens(tokens.accessToken, tokens.refreshToken);
    set({ status: 'authenticated', user: tokens.user });
    // Warm the critical home data immediately so the feed, greeting and
    // notification badge are already cached by the time the tabs mount.
    void prefetchHomeData(tokens.user);
  },
  signOut: async () => {
    try {
      await api.logout();
    } finally {
      await clearTokens();
      disconnectSocket();
      set({ status: 'unauthenticated', user: null });
    }
  },
}));
