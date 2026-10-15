import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastViewport } from '@/components/toast';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { usePushRegistration } from '@/hooks/use-push-registration';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/lib/auth-store';
import { useOnboardingStore } from '@/lib/onboarding-store';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrateOnboarding = useOnboardingStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateOnboarding();
  }, [hydrate, hydrateOnboarding]);

  // Route guard: redirects between the auth and app groups based on session.
  useAuthGuard();
  // Best-effort Expo push-token registration once a session exists.
  usePushRegistration();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {status === 'loading' ? (
          <View style={[styles.loading, { backgroundColor: theme.background }]}>
            <ActivityIndicator />
          </View>
        ) : null}
        <ToastViewport />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="board/[id]" />
          <Stack.Screen name="board/create" />
          <Stack.Screen name="board/edit" />
          <Stack.Screen name="board/[id]/map" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="notifications" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
