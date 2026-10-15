import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BrandMark } from '@/components/onboarding/brand-mark';
import { ProgressDots } from '@/components/onboarding/progress-dots';
import { SkipButton } from '@/components/onboarding/skip-button';
import { SlideTopBar } from '@/components/onboarding/slide-top-bar';
import { TagPill } from '@/components/onboarding/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DISCOVER_CARDS,
  ONBOARDING_IMAGES,
  ONBOARDING_SLIDE_COUNT,
} from '@/data/onboarding';
import { UI_MESSAGES } from '@travel-board/shared';

export interface SlideDiscoverProps {
  /** Currently visible slide index (drives the progress dots). */
  current: number;
  onSkip: () => void;
}

/** Slide 1 — "Discover your next adventure" (collage of tilted travel cards). */
export function SlideDiscover({ current, onSkip }: SlideDiscoverProps) {
  const theme = useTheme();
  const copy = UI_MESSAGES.ONBOARDING.DISCOVER;
  const photoTagStyle = [styles.photoTag, { backgroundColor: theme.overlay }];
  const cardPlaceholder = { backgroundColor: theme.backgroundElement };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <SlideTopBar leading={<BrandMark tone="solid" />} trailing={<SkipButton onPress={onSkip} />} />

        <Animated.View entering={FadeIn.duration(500)} style={styles.stage}>
          {/* Back-left card — Swiss Alps */}
          <View style={[styles.card, styles.cardAlps, cardPlaceholder, Shadows.card]}>
            <Image source={ONBOARDING_IMAGES.discoverAlps} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <View pointerEvents="none" style={[styles.scrim, { height: '52%', opacity: 0.55 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '26%', backgroundColor: theme.overlay }]} />
            <View style={[photoTagStyle, { alignSelf: 'flex-start' }]}>
              <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                {DISCOVER_CARDS.alps.tag}
              </ThemedText>
            </View>
            <View style={styles.cardFooterRow}>
              <View style={[styles.iconPill, { backgroundColor: theme.overlay }]}>
                <MaterialIcons name="star" size={11} color={theme.golden} />
                <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                  {DISCOVER_CARDS.alps.rating}
                </ThemedText>
              </View>
              <View style={[styles.iconPill, { backgroundColor: theme.surfaceCard }]}>
                <ThemedText type="smallBold" style={{ color: theme.text }}>
                  {DISCOVER_CARDS.alps.boards}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Back-right card — Kyoto */}
          <View style={[styles.card, styles.cardKyoto, cardPlaceholder, Shadows.card]}>
            <Image source={ONBOARDING_IMAGES.discoverKyoto} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <View pointerEvents="none" style={[styles.scrim, { height: '52%', opacity: 0.55 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '26%', backgroundColor: theme.overlay }]} />
            <View style={[photoTagStyle, { alignSelf: 'flex-end' }]}>
              <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                {DISCOVER_CARDS.kyoto.tag}
              </ThemedText>
            </View>
            <View style={styles.cardFooterRow}>
              <View style={[styles.iconPill, { backgroundColor: theme.overlay }]}>
                <MaterialIcons name="star" size={11} color={theme.golden} />
                <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                  {DISCOVER_CARDS.kyoto.rating}
                </ThemedText>
              </View>
              <View style={[styles.iconPill, { backgroundColor: theme.surfaceCard }]}>
                <ThemedText type="smallBold" style={{ color: theme.text }}>
                  {DISCOVER_CARDS.kyoto.boards}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Front-center card — Coastal Escapes */}
          <View style={[styles.card, styles.cardCoastal, cardPlaceholder, Shadows.card]}>
            <Image source={ONBOARDING_IMAGES.discoverCoastal} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <View pointerEvents="none" style={[styles.scrim, { height: '58%', opacity: 0.6 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '32%', backgroundColor: theme.overlay }]} />
            <View style={[photoTagStyle, { alignSelf: 'flex-start' }]}>
              <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                {DISCOVER_CARDS.coastal.tag}
              </ThemedText>
            </View>
            <View style={styles.coastalFooter}>
              <View style={styles.flexOne}>
                <ThemedText style={[styles.coastalTitle, { color: theme.onImage }]}>
                  {DISCOVER_CARDS.coastal.title}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.onImage, opacity: 0.85, fontSize: 12 }}
                >
                  {DISCOVER_CARDS.coastal.subtitle}
                </ThemedText>
              </View>
              <View style={styles.initialsRow}>
                {DISCOVER_CARDS.coastal.avatars.map((initials, i) => (
                  <View
                    key={initials}
                    style={[
                      styles.initialsCircle,
                      {
                        backgroundColor: theme.primaryContainer,
                        borderColor: theme.surfaceCard,
                        marginLeft: i === 0 ? 0 : -8,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.initialsText, { color: theme.primaryDark }]}>
                      {initials}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Floating stats pills */}
          <View style={[styles.floatPill, styles.floatPinned, { backgroundColor: theme.surfaceCard }]}>
            <MaterialIcons name="favorite" size={12} color={theme.primary} />
            <ThemedText type="smallBold">{DISCOVER_CARDS.pills.pinned}</ThemedText>
          </View>
          <View style={[styles.floatPill, styles.floatVisuals, { backgroundColor: theme.surfaceCard }]}>
            <MaterialIcons name="auto-awesome" size={12} color={theme.tertiary} />
            <ThemedText type="smallBold">{DISCOVER_CARDS.pills.visuals}</ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(420)} style={styles.copy}>
          <TagPill icon="public" label={copy.BADGE} />
          <ThemedText style={styles.title}>{copy.TITLE}</ThemedText>
          <ThemedText themeColor="textSecondary">{copy.BODY}</ThemedText>
          <ProgressDots count={ONBOARDING_SLIDE_COUNT} activeIndex={current} />
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
  stage: {
    height: 300,
    marginTop: Spacing.two,
    marginBottom: Spacing.five,
  },
  card: {
    position: 'absolute',
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  cardAlps: {
    left: 0,
    top: 30,
    width: '56%',
    height: 214,
    transform: [{ rotate: '-6deg' }],
  },
  cardKyoto: {
    right: 0,
    top: 4,
    width: '52%',
    height: 198,
    transform: [{ rotate: '8deg' }],
  },
  cardCoastal: {
    left: '15%',
    width: '70%',
    bottom: 4,
    height: 226,
    borderRadius: Radius.xxl,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  photoTag: {
    position: 'absolute',
    top: Spacing.two,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    marginHorizontal: Spacing.two,
  },
  cardFooterRow: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  coastalFooter: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  flexOne: { flex: 1 },
  coastalTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  initialsRow: { flexDirection: 'row' },
  initialsCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { fontSize: 10, fontWeight: '800' },
  floatPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    ...Shadows.card,
    shadowOpacity: 0.14,
  },
  floatPinned: { left: 0, bottom: 44, zIndex: 30 },
  floatVisuals: { right: 0, top: 130, zIndex: 30 },
  copy: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
});
