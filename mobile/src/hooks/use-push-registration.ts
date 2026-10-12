import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Registers this device's Expo push token with the API once the user is
 * authenticated. The backend stores the token in `push_tokens` (Postgres =
 * source of truth) and respects `user_settings.notificationsEnabled` at
 * delivery time, so the client always registers when permission is granted.
 *
 * Skipped on web (no Expo push transport) and when the user denies the
 * OS permission prompt. Best-effort: registration failures never block the
 * auth flow.
 */
export function usePushRegistration(): void {
  const status = useAuthStore((state) => state.status);
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || Platform.OS === 'web') {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const existing = await Notifications.getExpoPushTokenAsync().catch(
          () => null,
        );
        // getExpoPushTokenAsync throws when permission hasn't been asked yet.
        // Request it only if we don't already have a cached token.
        if (!existing) {
          const { status: permission } =
            await Notifications.requestPermissionsAsync();
          if (permission !== 'granted' || cancelled) {
            return;
          }
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenResponse.data;
        if (!token || cancelled || token === registeredTokenRef.current) {
          return;
        }

        await api.registerPushToken({ token, platform: 'EXPO' });
        registeredTokenRef.current = token;
      } catch {
        // Best-effort — push is an accelerator, never a hard dependency.
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Unregister on sign-out so we don't deliver to a dead session. Also
  // cleans up the stored token if the app logs out on another device.
  useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }
    const token = registeredTokenRef.current;
    if (!token) {
      return;
    }
    registeredTokenRef.current = null;
    void api.unregisterPushToken(token).catch(() => {});
  }, [status]);
}
