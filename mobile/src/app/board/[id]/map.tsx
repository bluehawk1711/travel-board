import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { BoardItem } from '@/lib/board-types';

interface MappedItem extends BoardItem {
  lat: number;
  lng: number;
}

/** Map of every item on the board that has Places coordinates. */
export default function BoardMapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['board', id],
    queryFn: () => api.getBoard(id ?? ''),
    enabled: Boolean(id),
  });

  const items: MappedItem[] =
    query.data?.sections.flatMap((section) =>
      section.items
        .filter((item) => item.lat != null && item.lng != null)
        .map((item) => ({ ...item, lat: item.lat as number, lng: item.lng as number })),
    ) ?? [];

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          No located places on this board yet. Add items by searching Google
          Places and they will show up here.
        </ThemedText>
        <Pressable onPress={() => router.back()}>
          <ThemedText type="small" themeColor="textSecondary">
            Go back
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const first = items[0];

  return (
    <View style={styles.screen}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: first.lat,
          longitude: first.lng,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        }}
      >
        {items.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            title={item.title}
            description={item.description ?? undefined}
          />
        ))}
      </MapView>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.background }]}
        >
          <ThemedText type="smallBold">← Back</ThemedText>
        </Pressable>
        <View style={[styles.countBadge, { backgroundColor: theme.background }]}>
          <ThemedText type="small">
            {items.length} {items.length === 1 ? 'place' : 'places'}
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  backBtn: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  countBadge: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centerText: { textAlign: 'center' },
});