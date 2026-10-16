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
import { UI_MESSAGES } from '@travel-board/shared';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Registration runs through a React Query mutation.
  const signUpMutation = useMutation({
    mutationFn: (vars: { name: string; email: string; password: string }) =>
      api.register(vars.name, vars.email, vars.password),
  });
  const submitting = signUpMutation.isPending;

  const submit = useCallback(async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError(UI_MESSAGES.AUTH.ALL_FIELDS_REQUIRED);
      return;
    }
    if (password.length < 8) {
      setError(UI_MESSAGES.AUTH.PASSWORD_TOO_SHORT);
      return;
    }
    if (password !== confirm) {
      setError(UI_MESSAGES.AUTH.PASSWORDS_MISMATCH);
      return;
    }
    setError(null);
    try {
      const tokens = await signUpMutation.mutateAsync({
        name: name.trim(),
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
  }, [name, email, password, confirm, router, setSession, signUpMutation]);

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
            title={UI_MESSAGES.AUTH.CREATE_ACCOUNT}
            subtitle={UI_MESSAGES.AUTH.JOIN_TAGLINE}
            footer={
              <View style={styles.footerRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {UI_MESSAGES.AUTH.HAVE_ACCOUNT}
                </ThemedText>
                <Pressable
                  onPress={() => router.replace('/(auth)/sign-in')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={UI_MESSAGES.AUTH.SIGN_IN}
                >
                  <ThemedText
                    type="smallBold"
                    style={[styles.footerLink, { color: theme.primary }]}
                  >
                    {UI_MESSAGES.AUTH.SIGN_IN}
                  </ThemedText>
                </Pressable>
              </View>
            }
          >
            <AuthField
              label={UI_MESSAGES.AUTH.NAME_LABEL}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />
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
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
            />
            <AuthField
              label={UI_MESSAGES.AUTH.CONFIRM_PASSWORD_LABEL}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your password"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />

            {error ? <AuthError message={error} /> : null}

            <PillButton
              label={UI_MESSAGES.AUTH.CREATE_ACCOUNT}
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
