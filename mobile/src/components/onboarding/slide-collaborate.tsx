import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BackButton } from '@/components/onboarding/back-button';
import { ProgressDots } from '@/components/onboarding/progress-dots';
import { SkipButton } from '@/components/onboarding/skip-button';
import { SlideTopBar } from '@/components/onboarding/slide-top-bar';
import { TagPill } from '@/components/onboarding/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  COLLABORATE_CARDS,
  ONBOARDING_SLIDE_COUNT,
} from '@/data/onboarding';
import { UI_MESSAGES } from '@travel-board/shared';

export interface SlideCollaborateProps {
  /** Currently visible slide index (drives the progress dots). */
  current: number;
  onBack: () => void;
  onSkip: () => void;
}

/** Slide 2 — "Plan trips together in real-time" (live session board). */
export function SlideCollaborate({ current, onBack, onSkip }: SlideCollaborateProps) {
  const theme = useTheme();
  const copy = UI_MESSAGES.ONBOARDING.COLLABORATE;
  const { session, collaborators, pins, activity } = COLLABORATE_CARDS;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <SlideTopBar
          leading={<BackButton onPress={onBack} />}
          center={<ProgressDots count={ONBOARDING_SLIDE_COUNT} activeIndex={current} />}
          trailing={<SkipButton onPress={onSkip} />}
        />

        <Animated.View entering={FadeIn.duration(500)} style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
          {/* Card header: live session + collaborator stack */}
          <View style={styles.headerRow}>
            <View style={styles.flexOne}>
              <View style={styles.liveRow}>
                <View style={[styles.liveDot, { backgroundColor: theme.tertiary }]} />
                <ThemedText style={[styles.liveLabel, { color: theme.tertiary }]}>
                  Live session
                </ThemedText>
              </View>
              <ThemedText style={styles.sessionTitle}>{session.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {session.subtitle}
              </ThemedText>
            </View>
            <View style={styles.avatarStack}>
              {collaborators.map((avatar, i) => (
                <Image
                  key={i}
                  source={avatar}
                  style={[
                    styles.avatar,
                    { borderColor: theme.surfaceCard, marginLeft: i === 0 ? 0 : -10 },
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
              <View style={[styles.avatar, styles.avatarMore, { borderColor: theme.surfaceCard, marginLeft: -10, backgroundColor: theme.primaryContainer }]}>
                <MaterialIcons name="add" size={13} color={theme.primaryDark} />
              </View>
            </View>
          </View>

          {/* Pinned place tiles */}
          <View style={styles.pinRow}>
            {pins.map((pin) => (
              <View key={pin.title} style={[styles.pinCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.pinImage, { backgroundColor: theme.backgroundSelected }]}>
                  <Image source={pin.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                  <View pointerEvents="none" style={[styles.scrim, { height: '48%', opacity: 0.55 }]} />
                  <View pointerEvents="none" style={[styles.scrim, { height: '24%', backgroundColor: theme.overlay }]} />
                  <View style={[styles.pinBadge, { backgroundColor: theme.overlay }]}>
                    <MaterialIcons name={pin.badgeIcon} size={11} color={theme.onImage} />
                    <ThemedText type="smallBold" style={{ color: theme.onImage, fontSize: 11 }}>
                      {pin.badge}
                    </ThemedText>
                  </View>
                  <View style={styles.pinFooter}>
                    <ThemedText style={[styles.pinTitle, { color: theme.onImage }]} numberOfLines={1}>
                      {pin.title}
                    </ThemedText>
                    <View style={styles.pinMetaRow}>
                      <ThemedText
                        type="smallBold"
                        style={{ color: pin.metaTone === 'golden' ? theme.golden : theme.tertiaryLight }}
                      >
                        {pin.meta}
                      </ThemedText>
                      <View style={[styles.likesPill, { backgroundColor: theme.overlay }]}>
                        <MaterialIcons name="favorite" size={10} color={theme.primary} />
                        <ThemedText type="smallBold" style={{ color: theme.onImage, fontSize: 11 }}>
                          {pin.likes}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Live activity feed */}
          <View style={styles.feed}>
            {activity.map((row) => (
              <View key={row.id} style={[styles.feedRow, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.feedAvatarWrap}>
                  <Image source={row.avatar} style={styles.feedAvatar} contentFit="cover" transition={200} />
                  {row.live ? (
                    <View style={[styles.feedDot, { backgroundColor: theme.tertiary, borderColor: theme.backgroundElement }]} />
                  ) : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flexOne}>
                  <ThemedText type="smallBold">{row.name} </ThemedText>
                  {row.action}{' '}
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {row.target}
                  </ThemedText>
                  {row.tail ? ` ${row.tail}` : ''}
                </ThemedText>
                {row.live ? (
                  <ThemedText type="small" themeColor="textSecondary">{row.time}</ThemedText>
                ) : (
                  <MaterialIcons name="favorite" size={13} color={theme.primary} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(420)} style={styles.copy}>
          <TagPill icon="sync" label={copy.BADGE} />
          <ThemedText style={styles.title}>{copy.TITLE}</ThemedText>
          <ThemedText themeColor="textSecondary">{copy.BODY}</ThemedText>
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
    padding: Spacing.four,
    gap: Spacing.three,
    marginBottom: Spacing.five,
    marginTop: Spacing.two,
    ...Shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flexOne: { flex: 1 },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  sessionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  avatarMore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pinCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.one,
  },
  pinImage: {
    height: 178,
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
  pinBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  pinFooter: {
    padding: Spacing.two,
    gap: 4,
  },
  pinTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  pinMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  feed: {
    gap: Spacing.two,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  feedAvatarWrap: {
    position: 'relative',
  },
  feedAvatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
  },
  feedDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  copy: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
