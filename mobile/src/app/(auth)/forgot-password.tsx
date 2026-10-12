import { useRouter } from 'expo-router';
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

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password reset request runs through a React Query mutation.
  const forgotMutation = useMutation({
    mutationFn: (vars: { email: string }) => api.forgotPassword(vars.email),
  });
  const submitting = forgotMutation.isPending;

  const submit = useCallback(async () => {
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setError(null);
    try {
      await forgotMutation.mutateAsync({ email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Something went wrong — try again',
      );
    }
  }, [email, forgotMutation]);

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
            Reset password
          </ThemedText>

          {sent ? (
            <View style={styles.sentBox}>
              <ThemedText themeColor="textSecondary" style={styles.sentText}>
                If an account exists with that email, you&apos;ll receive a
                password reset link shortly.
              </ThemedText>
              <Pressable
                onPress={() => router.replace('/(auth)/sign-in')}
                style={[styles.primaryButton, { backgroundColor: theme.text }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  Back to sign in
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Enter your email and we&apos;ll send you a link to reset your
                password.
              </ThemedText>

              <TextInput
                style={inputStyle}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              {error ? (
                <ThemedText type="small" style={{ color: '#dc2626' }}>
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
                    Send reset link
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}

          <Pressable onPress={() => router.back()}>
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
  sentBox: {
    gap: Spacing.three,
  },
  sentText: {
    lineHeight: 22,
  },
});
