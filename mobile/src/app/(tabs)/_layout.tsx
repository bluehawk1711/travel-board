import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import { FloatingDock } from '@/components/floating-dock';
import { useAuthStore } from '@/lib/auth-store';

export default function TabsLayout() {
  // Redirects (in both directions) are handled once by `useAuthGuard` in the
  // root layout — here we only hold the UI until the session is known.
  const status = useAuthStore((state) => state.status);

  if (status !== 'authenticated') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingDock {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Boards' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      {/* Secondary destinations — reached from Explore chips / deep links,
          hidden from the dock to match the 4-slot stitch navigation. */}
      <Tabs.Screen name="following" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="chat/index" options={{ title: 'Chat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Settings stays reachable via the Profile gear (`router.push('/settings')`)
          but is hidden from the dock — Profile owns the 4th slot. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
