import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UI_MESSAGES } from '@travel-board/shared';

export interface SkipButtonProps {
  onPress: () => void;
}

/** Text "Skip" action that exits the carousel straight to sign-in. */
export function SkipButton({ onPress }: SkipButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={UI_MESSAGES.ONBOARDING.SKIP}
      hitSlop={8}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
        {UI_MESSAGES.ONBOARDING.SKIP}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: TouchTarget - 16,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
