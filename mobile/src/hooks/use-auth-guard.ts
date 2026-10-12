import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';

/**
 * Client-side route guard for the mobile app — the Expo equivalent of the
 * web's `proxy.ts`. Unauthenticated users are pushed to sign-in from any
 * protected route; authenticated users are kept out of the auth screens.
 *
 * Mount once, high in the tree (root layout).
 */
export function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [router, segments, status]);
}
