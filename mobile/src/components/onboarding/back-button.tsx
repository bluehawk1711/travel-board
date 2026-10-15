import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UI_MESSAGES } from '@travel-board/shared';

export interface BackButtonProps {
  onPress: () => void;
}

/** Circular back affordance shown on carousel slides 2 and 3. */
export function BackButton({ onPress }: BackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={UI_MESSAGES.ONBOARDING.BACK}
      hitSlop={8}
      style={({ pressed }) => [
        styles.circle,
        { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons name="arrow-back" size={20} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
