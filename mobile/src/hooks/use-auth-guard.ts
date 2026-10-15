import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { useOnboardingStore } from '@/lib/onboarding-store';

/**
 * Client-side route guard for the mobile app — the Expo equivalent of the
 * web's `proxy.ts`. Unauthenticated users are pushed to sign-in (or the
 * first-run onboarding carousel) from any protected route; authenticated
 * users are kept out of the auth screens.
 *
 * Mount once, high in the tree (root layout).
 */
export function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const status = useAuthStore((state) => state.status);
  const seenOnboarding = useOnboardingStore((state) => state.seen);

  useEffect(() => {
    // Wait for both the session and the persisted onboarding flag so a cold
    // start never flashes sign-in before the intro carousel.
    if (status === 'loading' || seenOnboarding === null) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      // First run from the app home → intro carousel once; deep links and
      // returning users go straight to sign-in.
      const firstRun = !seenOnboarding && segments[0] === '(tabs)';
      router.replace(firstRun ? '/(auth)/onboarding' : '/(auth)/sign-in');
      return;
    }

    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [router, segments, status, seenOnboarding]);
}
