import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
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

  return <AppTabs />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
