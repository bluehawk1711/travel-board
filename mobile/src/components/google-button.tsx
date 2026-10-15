import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
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
        style={[
          styles.button,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
          !request && styles.disabled,
          style,
        ]}
      >
        <ThemedText type="smallBold">Continue with Google</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    textAlign: 'center',
  },
});
