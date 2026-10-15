import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogInRow } from '@/components/onboarding/log-in-row';
import { SlideCollaborate } from '@/components/onboarding/slide-collaborate';
import { SlideDiscover } from '@/components/onboarding/slide-discover';
import { SlideItinerary } from '@/components/onboarding/slide-itinerary';
import { SlideWelcome } from '@/components/onboarding/slide-welcome';
import { PillButton } from '@/components/ui/pill-button';
import { Spacing } from '@/constants/theme';
import { ONBOARDING_SLIDE_COUNT } from '@/data/onboarding';
import { useTheme } from '@/hooks/use-theme';
import { useOnboardingStore } from '@/lib/onboarding-store';
import { UI_MESSAGES } from '@travel-board/shared';

const SLIDES = [0, 1, 2, 3];
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

export type AuthRoute = '/(auth)/sign-in' | '/(auth)/sign-up';

/**
 * First-run onboarding carousel (Stitch `onboarding_1..4`). Paged horizontally;
 * Skip / Log In / Sign up mark the tour as seen and route into the auth flow.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const listRef = useRef<FlatList<number>>(null);
  const [index, setIndex] = useState(0);

  // Stable identity: FlatList requires both callbacks to never change.
  const onViewableChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (typeof first?.index === 'number') setIndex(first.index);
    },
    [],
  );

  // Reaching the final slide means the whole tour was seen — persist so a
  // force-quit before any CTA tap still lands on sign-in next launch.
  useEffect(() => {
    if (index === ONBOARDING_SLIDE_COUNT - 1) void markSeen();
  }, [index, markSeen]);

  const exit = useCallback(
    (route: AuthRoute) => {
      void markSeen().then(() => router.replace(route));
    },
    [markSeen, router],
  );

  const skip = useCallback(() => exit('/(auth)/sign-in'), [exit]);

  const scrollTo = useCallback((target: number) => {
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }, []);

  const goBack = useCallback(
    () => scrollTo(Math.max(index - 1, 0)),
    [scrollTo, index],
  );

  const goNext = useCallback(
    () => scrollTo(Math.min(index + 1, ONBOARDING_SLIDE_COUNT - 1)),
    [scrollTo, index],
  );

  const renderSlide = (slide: number) => {
    switch (slide) {
      case 0:
        return <SlideDiscover current={index} onSkip={skip} />;
      case 1:
        return <SlideCollaborate current={index} onBack={goBack} onSkip={skip} />;
      case 2:
        return <SlideItinerary current={index} onBack={goBack} onSkip={skip} />;
      default:
        return (
          <SlideWelcome
            current={index}
            onSignUp={() => exit('/(auth)/sign-up')}
            onLogIn={skip}
          />
        );
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => String(item)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>{renderSlide(item)}</View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onViewableItemsChanged={onViewableChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
      />
      {index < ONBOARDING_SLIDE_COUNT - 1 ? (
        <View style={[styles.footer, { borderTopColor: theme.borderSubtle }]}>
          <PillButton
            label={UI_MESSAGES.ONBOARDING.CONTINUE}
            onPress={goNext}
            icon={<MaterialIcons name="arrow-forward" size={16} color={theme.onPrimary} />}
            style={styles.continueButton}
          />
          <LogInRow onLogIn={skip} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  continueButton: {
    alignSelf: 'stretch',
  },
});
