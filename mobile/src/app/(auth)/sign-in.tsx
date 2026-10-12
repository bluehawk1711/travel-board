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
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';
import { GoogleButton } from '@/components/google-button';
import { UI_MESSAGES } from '@travel-board/shared';

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
            Sign in
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
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.forgot}>
              Forgot password?
            </ThemedText>
          </Pressable>

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
                 Sign in
               </ThemedText>
             )}
           </Pressable>

           <GoogleButton />

           <Pressable onPress={() => router.push('/(auth)/sign-up')}>
             <ThemedText type="small" themeColor="textSecondary" style={styles.switchText}>
               Don&apos;t have an account?{' '}
               <ThemedText type="smallBold" style={{ color: theme.text }}>
                 Sign up
               </ThemedText>
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
  forgot: {
    marginTop: -Spacing.two,
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
