import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const SEEN_KEY = 'onboarding.seen';

export interface OnboardingState {
  /**
   * Whether the first-run intro carousel has been completed. `null` until
   * the persisted flag has been read — the route guard waits for it so a
   * cold start never flashes sign-in before onboarding.
   */
  seen: boolean | null;
  hydrate: () => Promise<void>;
  markSeen: () => Promise<void>;
}

/**
 * First-run onboarding flag. Not a secret (unlike auth tokens), so plain
 * AsyncStorage is right — losing it only replays the intro carousel.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: null,

  hydrate: async () => {
    try {
      const value = await AsyncStorage.getItem(SEEN_KEY);
      set({ seen: value === '1' });
    } catch {
      // Fail open: if storage is unavailable, skip the intro rather than
      // trapping the user in it on every launch.
      set({ seen: true });
    }
  },

  markSeen: async () => {
    set({ seen: true });
    try {
      await AsyncStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Non-critical — the in-memory flag still routes this session.
    }
  },
}));
