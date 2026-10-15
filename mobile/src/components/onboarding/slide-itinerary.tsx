import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BackButton } from '@/components/onboarding/back-button';
import { ProgressDots } from '@/components/onboarding/progress-dots';
import { SkipButton } from '@/components/onboarding/skip-button';
import { SlideTopBar } from '@/components/onboarding/slide-top-bar';
import { TagPill } from '@/components/onboarding/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';
import { ITINERARY_CARDS, ONBOARDING_SLIDE_COUNT } from '@/data/onboarding';
import { UI_MESSAGES } from '@travel-board/shared';

export interface SlideItineraryProps {
  /** Currently visible slide index (drives the progress dots). */
  current: number;
  onBack: () => void;
  onSkip: () => void;
}

const STOP_TONES: Record<string, ThemeColor> = {
  primary: 'primary',
  golden: 'golden',
  tertiary: 'tertiary',
};

/** Slide 3 — "Save places, build effortless itineraries" (day-2 itinerary). */
export function SlideItinerary({ current, onBack, onSkip }: SlideItineraryProps) {
  const theme = useTheme();
  const [saved, setSaved] = useState(true);
  const copy = UI_MESSAGES.ONBOARDING.ITINERARY;
  const { collection, place, stops, stopsLabel, hint } = ITINERARY_CARDS;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <SlideTopBar
          leading={<BackButton onPress={onBack} />}
          center={<ProgressDots count={ONBOARDING_SLIDE_COUNT} activeIndex={current} />}
          trailing={<SkipButton onPress={onSkip} />}
        />

        <Animated.View entering={FadeIn.duration(500)} style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
          {/* Collection header */}
          <View style={styles.collectionHeader}>
            <TagPill icon="push-pin" label={collection.section} />
            <ThemedText type="small" themeColor="textSecondary">{collection.window}</ThemedText>
          </View>
          <View style={styles.collectionTitleBlock}>
            <ThemedText style={styles.collectionTitle}>{collection.title}</ThemedText>
            <View style={styles.statsRow}>
              <View style={[styles.liveDot, { backgroundColor: theme.tertiary }]} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                {collection.placesSaved}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {' • '}
                {collection.routesSynced}
              </ThemedText>
            </View>
          </View>

          {/* Saved place */}
          <View style={[styles.placeBlock, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.placeImage, { backgroundColor: theme.backgroundSelected }]}>
              <Image source={place.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              <View pointerEvents="none" style={[styles.scrim, { height: '50%', opacity: 0.55 }]} />
              <View pointerEvents="none" style={[styles.scrim, { height: '26%', backgroundColor: theme.overlay }]} />
              <Pressable
                onPress={() => setSaved((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={place.name}
                style={({ pressed }) => [
                  styles.bookmarkButton,
                  { backgroundColor: theme.surfaceCard },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name={saved ? 'bookmark' : 'bookmark-border'}
                  size={17}
                  color={saved ? theme.primary : theme.textSecondary}
                />
              </Pressable>
              <View style={styles.placeImageFooter}>
                <View style={[styles.ratingPill, { backgroundColor: theme.overlay }]}>
                  <MaterialIcons name="star" size={11} color={theme.golden} />
                  <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                    {place.rating}
                  </ThemedText>
                </View>
                <View style={[styles.categoryPill, { backgroundColor: theme.surfaceCard }]}>
                  <ThemedText type="smallBold" style={{ fontSize: 11 }}>{place.category}</ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.placeDetails}>
              <ThemedText style={styles.placeName} numberOfLines={1}>{place.name}</ThemedText>
              <View style={[styles.slotPill, { backgroundColor: theme.tertiaryLight }]}>
                <ThemedText type="smallBold" style={{ color: theme.tertiary, fontSize: 11 }}>
                  {place.slot}
                </ThemedText>
              </View>
            </View>
            <View style={styles.targetRow}>
              <MaterialIcons name="schedule" size={14} color={theme.primary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flexOne}>
                {place.target}
              </ThemedText>
            </View>
          </View>

          {/* Saved toast */}
          <View style={[styles.toast, { backgroundColor: theme.text }]}>
            <MaterialIcons name="check-circle" size={16} color={theme.tertiaryLight} />
            <ThemedText type="smallBold" style={[styles.flexOne, { color: theme.onImage }]}>
              {place.saved}
            </ThemedText>
            <View style={[styles.toastTag, { backgroundColor: theme.surfaceCard }]}>
              <ThemedText type="smallBold" style={{ color: theme.text, fontSize: 11 }}>
                {place.savedTag}
              </ThemedText>
            </View>
          </View>

          {/* Day sequence */}
          <View style={[styles.timeline, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.timelineHeader}>
              <MaterialIcons name="route" size={15} color={theme.primary} />
              <ThemedText style={[styles.timelineTitle, { color: theme.textSecondary }]}>
                {collection.sequence}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                {stopsLabel}
              </ThemedText>
            </View>
            {stops.map((stop, i) => (
              <View key={stop.title} style={styles.stopRow}>
                <View style={styles.stopRail}>
                  <View
                    style={[
                      styles.stopDot,
                      { backgroundColor: theme[STOP_TONES[stop.tone] ?? 'primary'] },
                    ]}
                  />
                  {i < stops.length - 1 ? (
                    <View style={[styles.stopLine, { backgroundColor: theme.borderSubtle }]} />
                  ) : null}
                </View>
                <View style={styles.flexOne}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {stop.time} · {stop.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {stop.note}
                  </ThemedText>
                </View>
                <View style={[styles.savedChip, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={[styles.savedChipText, { color: theme.textSecondary }]}>
                    {collection.savedChip}
                  </ThemedText>
                </View>
              </View>
            ))}
            <View style={[styles.hintPill, { backgroundColor: theme.surfaceCard }]}>
              <MaterialIcons name="drag-indicator" size={13} color={theme.primary} />
              <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(420)} style={styles.copy}>
          <TagPill icon="bookmark" label={copy.BADGE} />
          <ThemedText style={styles.title}>{copy.TITLE}</ThemedText>
          <ThemedText themeColor="textSecondary">{copy.BODY}</ThemedText>
          <View style={styles.perksRow}>
            <TagPill icon="navigation" label={copy.PERK_ROUTED} tone="neutral" />
            <TagPill icon="cloud-sync" label={copy.PERK_OFFLINE} tone="neutral" />
            <TagPill icon="group" label={copy.PERK_SHARED} tone="neutral" />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    flexGrow: 1,
  },
  card: {
    borderRadius: Radius.xxl,
    padding: Spacing.three,
    gap: Spacing.three,
    marginBottom: Spacing.four,
    marginTop: Spacing.two,
    ...Shadows.card,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  collectionTitleBlock: {
    gap: 4,
  },
  collectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  placeBlock: {
    borderRadius: Radius.lg,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  placeImage: {
    height: 148,
    borderRadius: Radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bookmarkButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  placeImageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  categoryPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  placeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  placeName: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  slotPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flexOne: { flex: 1 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    padding: Spacing.two,
  },
  toastTag: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  timeline: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  timelineTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  stopRail: {
    width: 16,
    alignItems: 'center',
    paddingTop: 5,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  stopLine: {
    position: 'absolute',
    top: 17,
    bottom: -14,
    width: 2,
    borderRadius: 1,
  },
  savedChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  savedChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
    ...Shadows.card,
    shadowOpacity: 0.1,
  },
  copy: {
    gap: Spacing.three,
  },
  perksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
