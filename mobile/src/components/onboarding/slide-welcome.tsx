import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BrandMark } from '@/components/onboarding/brand-mark';
import { LogInRow } from '@/components/onboarding/log-in-row';
import { ProgressDots } from '@/components/onboarding/progress-dots';
import { SlideTopBar } from '@/components/onboarding/slide-top-bar';
import { GoogleButton } from '@/components/google-button';
import { PillButton } from '@/components/ui/pill-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WELCOME_CARDS, ONBOARDING_SLIDE_COUNT } from '@/data/onboarding';
import { APP, UI_MESSAGES } from '@travel-board/shared';

export interface SlideWelcomeProps {
  /** Currently visible slide index (drives the progress dots). */
  current: number;
  onSignUp: () => void;
  onLogIn: () => void;
}

const openUrl = (url: string) => {
  void Linking.openURL(url);
};

/** Slide 4 — welcome / sign-in cluster (final slide of the carousel). */
export function SlideWelcome({ current, onSignUp, onLogIn }: SlideWelcomeProps) {
  const theme = useTheme();
  const copy = UI_MESSAGES.ONBOARDING.WELCOME;
  const [proofRating, ...proofRest] = copy.SOCIAL_PROOF.split(' • ');
  const { back, middle, front } = WELCOME_CARDS;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <SlideTopBar
          leading={<BrandMark tone="soft" />}
          center={
            <View style={styles.stepRow}>
              <ProgressDots count={ONBOARDING_SLIDE_COUNT} activeIndex={current} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                {UI_MESSAGES.ONBOARDING.STEP_LABEL(current + 1, ONBOARDING_SLIDE_COUNT)}
              </ThemedText>
            </View>
          }
        />

        {/* Photobook stack */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.stack}>
          <View style={[styles.stackCard, styles.stackBack, { backgroundColor: theme.backgroundElement }, Shadows.card]}>
            <Image source={back.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <View pointerEvents="none" style={[styles.scrim, { height: '46%', opacity: 0.55 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '24%', backgroundColor: theme.overlay }]} />
            <View style={styles.stackFooterRow}>
              <ThemedText type="smallBold" style={[styles.stackLabel, { color: theme.onImage }]}>
                {back.label}
              </ThemedText>
              <MaterialIcons name="bookmark" size={14} color={theme.onImage} />
            </View>
          </View>

          <View style={[styles.stackCard, styles.stackMiddle, { backgroundColor: theme.backgroundElement }, Shadows.card]}>
            <Image source={middle.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <View pointerEvents="none" style={[styles.scrim, { height: '46%', opacity: 0.55 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '24%', backgroundColor: theme.overlay }]} />
            <View style={styles.stackFooterRow}>
              <ThemedText type="smallBold" style={[styles.stackLabel, { color: theme.onImage }]}>
                {middle.label}
              </ThemedText>
              <View style={styles.stackRating}>
                <MaterialIcons name="star" size={12} color={theme.golden} />
                <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                  {middle.rating}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.stackCard, styles.stackFront, { backgroundColor: theme.backgroundElement }, Shadows.card]}>
            <Image source={front.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <View pointerEvents="none" style={[styles.scrim, { height: '68%', opacity: 0.6 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '40%', backgroundColor: theme.overlay }]} />
            <View style={styles.frontTopRow}>
              <View style={[styles.frontPill, { backgroundColor: theme.overlay }]}>
                <View style={[styles.liveDot, { backgroundColor: theme.tertiary }]} />
                <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                  {front.ready}
                </ThemedText>
              </View>
              <View style={[styles.frontPill, { backgroundColor: theme.text }]}>
                <MaterialIcons name="favorite" size={11} color={theme.primary} />
                <ThemedText type="smallBold" style={{ color: theme.onImage }}>
                  {front.likes}
                </ThemedText>
              </View>
            </View>
            <View style={styles.frontBottom}>
              <View style={styles.frontMetaRow}>
                <View style={[styles.statusPill, { backgroundColor: theme.primary }]}>
                  <ThemedText style={[styles.statusText, { color: theme.onImage }]}>
                    {front.status}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" style={{ color: theme.onImage, opacity: 0.9 }}>
                  {front.duration}
                </ThemedText>
              </View>
              <ThemedText style={[styles.frontTitle, { color: theme.onImage }]}>
                {front.title}
              </ThemedText>
              <View style={styles.frontMetaRow}>
                <ThemedText type="small" style={{ color: theme.onImage, opacity: 0.85 }}>
                  {front.meta}
                </ThemedText>
                <View style={styles.frontAvatars}>
                  {front.avatars.map((avatar, i) => (
                    <Image
                      key={i}
                      source={avatar}
                      style={[
                        styles.frontAvatar,
                        { borderColor: theme.surfaceCard, marginLeft: i === 0 ? 0 : -8 },
                      ]}
                      contentFit="cover"
                      transition={200}
                    />
                  ))}
                  <View
                    style={[
                      styles.frontAvatar,
                      styles.frontAvatarMore,
                      { borderColor: theme.surfaceCard, marginLeft: -8, backgroundColor: theme.surfaceCard },
                    ]}
                  >
                    <ThemedText style={[styles.frontMoreText, { color: theme.text }]}>
                      {front.overflow}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Copy + social proof */}
        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.copy}>
          <View style={styles.eyebrowRow}>
            <MaterialIcons name="auto-awesome" size={14} color={theme.primary} />
            <ThemedText style={[styles.eyebrow, { color: theme.primary }]}>
              {copy.EYEBROW}
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>
            {copy.TITLE}{' '}
            <ThemedText style={{ color: theme.primary }}>{copy.TITLE_ACCENT}</ThemedText>
          </ThemedText>
          <ThemedText themeColor="textSecondary">{copy.BODY}</ThemedText>

          <View style={[styles.proofRow, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.proofAvatars}>
              {WELCOME_CARDS.proofAvatars.map((avatar, i) => (
                <Image
                  key={i}
                  source={avatar}
                  style={[
                    styles.proofAvatar,
                    { borderColor: theme.backgroundElement, marginLeft: i === 0 ? 0 : -8 },
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flexOne}>
              <ThemedText type="smallBold">{proofRating}</ThemedText>
              {proofRest.length > 0 ? ` • ${proofRest.join(' • ')}` : ''}
            </ThemedText>
            <MaterialIcons name="verified" size={16} color={theme.tertiary} />
          </View>
        </Animated.View>

        {/* Auth cluster */}
        <Animated.View entering={FadeInDown.delay(200).duration(420)} style={styles.actions}>
          <GoogleButton
            style={{
              backgroundColor: theme.surfaceCard,
              borderColor: theme.borderSubtle,
              borderRadius: Radius.full,
              ...Shadows.card,
            }}
          />
          <PillButton
            label={copy.SIGN_UP_EMAIL}
            onPress={onSignUp}
            icon={<MaterialIcons name="mail" size={16} color={theme.onPrimary} />}
            style={styles.stretch}
          />
          <LogInRow onLogIn={onLogIn} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.legal}>
            {copy.LEGAL_PREFIX}{' '}
            <Text
              style={styles.legalLink}
              onPress={() => openUrl(APP.urls.terms)}
              suppressHighlighting
            >
              {copy.TERMS}
            </Text>{' '}
            {copy.LEGAL_AND}{' '}
            <Text
              style={styles.legalLink}
              onPress={() => openUrl(APP.urls.privacy)}
              suppressHighlighting
            >
              {copy.PRIVACY}
            </Text>
            .
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    flexGrow: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stack: {
    height: 264,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  stackCard: {
    position: 'absolute',
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  stackBack: {
    left: 4,
    right: 32,
    top: 10,
    height: 188,
    opacity: 0.75,
    transform: [{ rotate: '-3deg' }],
  },
  stackMiddle: {
    left: 32,
    right: 4,
    top: 6,
    height: 194,
    opacity: 0.9,
    transform: [{ rotate: '3deg' }],
  },
  stackFront: {
    left: 8,
    right: 8,
    bottom: 0,
    height: 214,
    borderRadius: Radius.xxl,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  stackFooterRow: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  stackLabel: {
    flexShrink: 1,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stackRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  frontTopRow: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  frontPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  frontBottom: {
    padding: Spacing.three,
    gap: 4,
  },
  frontMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  frontTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  frontAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frontAvatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  frontAvatarMore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frontMoreText: {
    fontSize: 9,
    fontWeight: '800',
  },
  copy: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  proofAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proofAvatar: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  flexOne: { flex: 1 },
  actions: {
    gap: Spacing.three,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  legal: {
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
