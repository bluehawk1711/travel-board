import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import {
  AuthDivider,
  AuthError,
  AuthField,
  AuthShell,
} from '@/components/auth-shell';
import { GoogleButton } from '@/components/google-button';
import { ThemedText } from '@/components/themed-text';
import { PillButton } from '@/components/ui/pill-button';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';
import { APP, UI_MESSAGES } from '@travel-board/shared';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auth calls run through React Query mutations.
  const signInMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      api.login(vars.email, vars.password),
  });
  const submitting = signInMutation.isPending;

  const submit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError(UI_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED);
      return;
    }
    setError(null);
    try {
      const tokens = await signInMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
      });
      await setSession(tokens);
      queryClient.clear();
      router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR,
      );
    }
  }, [email, password, router, setSession, signInMutation]);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthShell
            title={UI_MESSAGES.AUTH.WELCOME_BACK}
            subtitle={APP.tagline}
            footer={
              <View style={styles.footerRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {UI_MESSAGES.AUTH.NEW_HERE}
                </ThemedText>
                <Pressable
                  onPress={() => router.replace('/(auth)/sign-up')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={UI_MESSAGES.AUTH.CREATE_ACCOUNT}
                >
                  <ThemedText
                    type="smallBold"
                    style={[styles.footerLink, { color: theme.primary }]}
                  >
                    {UI_MESSAGES.AUTH.CREATE_ACCOUNT}
                  </ThemedText>
                </Pressable>
              </View>
            }
          >
            <AuthField
              label={UI_MESSAGES.AUTH.EMAIL_LABEL}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <AuthField
              label={UI_MESSAGES.AUTH.PASSWORD_LABEL}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              rightSlot={
                <Pressable
                  onPress={() => router.push('/(auth)/forgot-password')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={UI_MESSAGES.AUTH.FORGOT_PASSWORD}
                >
                  <ThemedText
                    type="small"
                    style={[styles.link, { color: theme.primary }]}
                  >
                    {UI_MESSAGES.AUTH.FORGOT_PASSWORD}
                  </ThemedText>
                </Pressable>
              }
            />

            {error ? <AuthError message={error} /> : null}

            <PillButton
              label={UI_MESSAGES.AUTH.SIGN_IN}
              onPress={() => void submit()}
              loading={submitting}
              disabled={submitting}
              style={styles.submitButton}
            />

            <AuthDivider label={UI_MESSAGES.AUTH.OR} />

            <GoogleButton />
          </AuthShell>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.four,
  },
  submitButton: {
    alignSelf: 'stretch',
  },
  link: {
    textDecorationLine: 'underline',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TouchTarget - 16,
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
