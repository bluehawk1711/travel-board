import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
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
  meta?: string | null;
  /** Trip length chip over the cover (e.g. "7 Days"). */
  durationLabel?: string | null;
  /** Owner shown in the footer row (avatar + name). */
  owner?: { name: string; avatarUrl?: string | null } | null;
  likeCount?: number;
  saveCount?: number;
  /** Cover aspect ratio (width/height). Varies per tile for masonry. */
  aspectRatio?: number;
}

/** Trip length chip label ("7 Days") derived from a board's date range. */
export function durationLabel(item: {
  startDate: string | null;
  endDate: string | null;
}): string | null {
  if (!item.startDate || !item.endDate) return null;
  const start = new Date(item.startDate).getTime();
  const end = new Date(item.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days <= 0 || days > 60) return null;
  return `${days} ${days === 1 ? 'Day' : 'Days'}`;
}

function formatCount(n?: number): string | null {
  if (n == null) return null;
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/**
 * Discovery card (DESIGN.md §Cards & Moodboard Tiles): edge-to-edge
 * photography, rounded 20px, warm elevation, and a bottom scrim that keeps the
 * overlay label legible over any image. Optional footer shows the owner and
 * save/like counts for the masonry feed.
 */
export function BoardCard({
  board,
  onPress,
  saved = false,
  onSave,
}: {
  board: BoardCardModel;
  onPress?: () => void;
  saved?: boolean;
  onSave?: () => void;
}) {
  const theme = useTheme();

  const saves = formatCount(board.saveCount);
  const likes = formatCount(board.likeCount);

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
      <View
        style={[
          styles.cover,
          { backgroundColor: theme.backgroundElement, aspectRatio: board.aspectRatio ?? 4 / 5 },
        ]}
      >
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

        {/* Top row: duration chip (left) + save button (right). */}
        <View style={styles.topRow}>
          {board.durationLabel ? (
            <Badge label={board.durationLabel} tone="glass" />
          ) : (
            <View />
          )}
          {onSave ? (
            <Pressable
              onPress={onSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save board'}
              style={[styles.saveBtn, { backgroundColor: theme.overlay }]}
            >
              <MaterialIcons
                name={saved ? 'bookmark' : 'bookmark-border'}
                size={18}
                color={theme.onImage}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Badge under the top row when there is no save button. */}
        {board.badge && !onSave ? (
          <View style={styles.badgeSlot}>
            <Badge label={board.badge} tone="glass" />
          </View>
        ) : null}

        <View style={styles.overlayText}>
          <ThemedText
            style={[styles.overlayTitle, { color: theme.onImage }]}
            numberOfLines={2}
          >
            {board.title}
          </ThemedText>
          {board.destination ? (
            <ThemedText style={styles.overlayMeta} numberOfLines={1}>
              ◎ {board.destination}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {/* Footer: owner + counts, or the legacy meta line. */}
      {board.owner ? (
        <View style={styles.footer}>
          <View style={styles.ownerRow}>
            <Avatar uri={board.owner.avatarUrl} name={board.owner.name} size={22} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.ownerName}>
              {board.owner.name}
            </ThemedText>
          </View>
          <View style={styles.statsRow}>
            {saves ? (
              <View style={styles.stat}>
                <Ionicons name="bookmark" size={13} color={theme.golden} />
                <ThemedText type="small" themeColor="textSecondary">{saves}</ThemedText>
              </View>
            ) : null}
            {likes ? (
              <View style={styles.stat}>
                <Ionicons name="heart" size={13} color={theme.primary} />
                <ThemedText type="small" themeColor="textSecondary">{likes}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      ) : board.meta ? (
        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {board.meta}
          </ThemedText>
        </View>
      ) : null}
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
  topRow: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSlot: { position: 'absolute', top: Spacing.two, left: Spacing.two },
  overlayText: {
    padding: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  overlayTitle: {
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
    gap: Spacing.one,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  ownerName: { flexShrink: 1 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
});
