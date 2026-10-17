import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'theme.mode';

/** User-selectable appearance: follow the OS, or force light/dark. */
export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';

interface ThemeState {
  mode: ThemeMode;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

/**
 * Appearance preference. Not a secret (unlike auth tokens), so plain
 * AsyncStorage is right — losing it just falls back to the system scheme.
 * Local persistence makes the toggle apply instantly and survive restarts;
 * the server-side `settings.themeMode` mirrors it via the Settings screen.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'SYSTEM',

  hydrate: async () => {
    try {
      const value = await AsyncStorage.getItem(KEY);
      if (value === 'LIGHT' || value === 'DARK' || value === 'SYSTEM') {
        set({ mode: value });
      }
    } catch {
      // Fail open: storage unavailable → system scheme.
    }
  },

  setMode: async (mode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(KEY, mode);
    } catch {
      // Non-critical — the in-memory mode still applies this session.
    }
  },
}));
