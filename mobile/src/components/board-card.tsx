import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/pill-button';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface BoardCardModel {
  id: string;
  coverImageUrl: string | null;
  title: string;
  destination: string | null;
  /** Optional chip shown over the cover (e.g. "Itinerary", "Private"). */
  badge?: string | null;
  /** Secondary line under the title (e.g. "12 items · ♥ 34"). */
  meta: string;
}

/**
 * Discovery card (DESIGN.md §Cards & Moodboard Tiles): edge-to-edge
 * photography, rounded 20px, warm elevation, and a bottom scrim that keeps the
 * overlay label legible over any image.
 */
export function BoardCard({
  board,
  onPress,
}: {
  board: BoardCardModel;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surfaceCard,
          borderColor: theme.borderSubtle,
        },
        Shadows.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.cover, { backgroundColor: theme.backgroundElement }]}>
        {board.coverImageUrl ? (
          <Image
            source={{ uri: board.coverImageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholder}>
            <ThemedText
              type="smallBold"
              themeColor="textSecondary"
              numberOfLines={3}
              style={styles.placeholderText}
            >
              {board.destination ?? board.title}
            </ThemedText>
          </View>
        )}

        {/* Bottom scrim — stacked translucent bands stand in for a gradient
            (keeps the design's legibility without a gradient dependency). */}
        <View style={[styles.scrimWeak, { backgroundColor: theme.overlay }]} />
        <View style={[styles.scrimStrong, { backgroundColor: theme.overlay }]} />

        {board.badge ? (
          <View style={styles.badgeSlot}>
            <Badge label={board.badge} tone="glass" />
          </View>
        ) : null}

        <View style={styles.overlayText}>
          <ThemedText style={styles.overlayTitle} numberOfLines={2}>
            {board.title}
          </ThemedText>
          {board.destination ? (
            <ThemedText style={styles.overlayMeta} numberOfLines={1}>
              ◎ {board.destination}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {board.meta}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  cover: {
    width: '100%',
    aspectRatio: 4 / 5,
    justifyContent: 'flex-end',
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  placeholderText: { textAlign: 'center' },
  scrimWeak: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    opacity: 0.45,
  },
  scrimStrong: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '22%',
    opacity: 0.75,
  },
  badgeSlot: { position: 'absolute', top: Spacing.two, left: Spacing.two },
  overlayText: {
    padding: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  overlayMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two,
  },
});