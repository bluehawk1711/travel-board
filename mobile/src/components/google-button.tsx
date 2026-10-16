import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthError } from '@/components/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';
import { UI_MESSAGES } from '@travel-board/shared';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth client IDs. Real IDs come from Google Cloud Console via
 * `EXPO_PUBLIC_GOOGLE_*` env vars — until they are configured, clearly-fake
 * placeholders keep the sign-in screen rendering (the request hook throws
 * on Android when androidClientId is undefined). Exchanging a token with a
 * placeholder ID fails at Google, so real credentials are still required
 * for sign-in to actually work.
 */
const DEMO_CLIENT_SUFFIX = '.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  `demo-ios-client-id${DEMO_CLIENT_SUFFIX}`;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  `demo-android-client-id${DEMO_CLIENT_SUFFIX}`;
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  `demo-web-client-id${DEMO_CLIENT_SUFFIX}`;

export function GoogleButton({ style }: { style?: object } = {}) {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    const idToken = response?.type === 'success' ? response.params.id_token : null;
    if (!idToken) return;

    let active = true;
    void api
      .googleMobile(idToken)
      .then(async (tokens) => {
        if (!active) return;
        await setSession(tokens);
        queryClient.clear();
        router.replace('/(tabs)');
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : UI_MESSAGES.AUTH.GOOGLE_FAILED,
        );
      });

    return () => {
      active = false;
    };
  }, [response, router, setSession]);

  return (
    <>
      <Pressable
        onPress={() => void promptAsync()}
        disabled={!request}
        accessibilityRole="button"
        accessibilityLabel={UI_MESSAGES.AUTH.GOOGLE_CONTINUE}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          },
          pressed && styles.pressed,
          !request && styles.disabled,
          style,
        ]}
      >
        {request ? (
          <Ionicons name="logo-google" size={18} color={theme.primary} />
        ) : (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        )}
        <ThemedText type="smallBold">{UI_MESSAGES.AUTH.GOOGLE_CONTINUE}</ThemedText>
      </Pressable>
      {error ? <AuthError message={error} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    width: '100%',
    minHeight: TouchTarget,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
