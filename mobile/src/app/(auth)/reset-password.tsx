import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';
import { UI_MESSAGES } from '@travel-board/shared';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Password reset runs through a React Query mutation.
  const resetMutation = useMutation({
    mutationFn: (vars: { token: string; password: string }) =>
      api.resetPassword(vars.token, vars.password),
  });
  const submitting = resetMutation.isPending;

  const submit = useCallback(async () => {
    if (!token) {
      setError(UI_MESSAGES.AUTH.INVALID_RESET_LINK);
      return;
    }
    if (!password || password.length < 8) {
      setError(UI_MESSAGES.AUTH.PASSWORD_TOO_SHORT);
      return;
    }
    if (password !== confirm) {
      setError(UI_MESSAGES.AUTH.PASSWORDS_MISMATCH);
      return;
    }
    setError(null);
    try {
      const tokens = await resetMutation.mutateAsync({ token, password });
      await setSession(tokens);
      queryClient.clear();
      router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR,
      );
    }
  }, [token, password, confirm, router, setSession, resetMutation]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: theme.backgroundSelected,
      color: theme.text,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.title}>
            Set new password
          </ThemedText>

          <TextInput
            style={inputStyle}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={inputStyle}
            placeholder="Confirm new password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
          />

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={submitting}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.text },
              submitting && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: theme.background }}
              >
                Reset password
              </ThemedText>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/sign-in')}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.switchText}>
              Back to sign in
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.three,
  },
  title: {
    marginBottom: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
  switchText: {
    textAlign: 'center',
  },
});
