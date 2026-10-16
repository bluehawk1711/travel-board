import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceMapProps } from './place-map';

/**
 * Web fallback for the Explore map: react-native-maps has no web support, so
 * render a stylized placeholder that still lists the pins. Native uses the
 * real map in `place-map.tsx`; Metro resolves this file for web.
 */
export function PlaceMap({ places, onSelect }: PlaceMapProps) {
  const theme = useTheme();

  return (
    <View style={[styles.fill, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, row) => (
          <View key={row} style={[styles.row, { borderColor: theme.borderSubtle }]} />
        ))}
      </View>
      <View style={styles.overlay}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.note}>
          Map preview (web) — {places.length} places
        </ThemedText>
        <View style={styles.list}>
          {places.slice(0, 6).map((place) => (
            <ThemedText
              key={place.placeId}
              type="small"
              themeColor="text"
              onPress={() => onSelect(place.placeId)}
              style={styles.item}
            >
              {place.rating != null ? `★ ${place.rating.toFixed(1)}  ` : '◎  '}
              {place.name}
            </ThemedText>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  grid: { ...StyleSheet.absoluteFill, justifyContent: 'space-evenly' },
  row: { height: StyleSheet.hairlineWidth, borderWidth: StyleSheet.hairlineWidth },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  note: { textAlign: 'center' },
  list: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
    maxWidth: 280,
    width: '100%',
  },
  item: { textAlign: 'center' },
});
