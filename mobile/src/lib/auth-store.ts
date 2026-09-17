import { create } from 'zustand';

import {
  ApiError,
  api,
  clearTokens,
  getAccessToken,
  saveTokens,
} from './api';
import { disconnectSocket } from './socket';
import type { AuthUser, TokensResponse } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

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
