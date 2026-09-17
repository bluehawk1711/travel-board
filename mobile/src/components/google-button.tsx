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

WebBrowser.maybeCompleteAuthSession();

export function GoogleButton() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
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
          err instanceof ApiError
            ? err.message
            : 'Google sign-in failed — try again',
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
        ]}
      >
        <ThemedText type="smallBold">Continue with Google</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" style={styles.error}>
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
    color: '#dc2626',
    textAlign: 'center',
  },
});
