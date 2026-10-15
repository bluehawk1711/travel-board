import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UI_MESSAGES } from '@travel-board/shared';

export interface LogInRowProps {
  onLogIn: () => void;
}

/** "Already have an account? Log In" — used by the pager footer and slide 4. */
export function LogInRow({ onLogIn }: LogInRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onLogIn}
      accessibilityRole="button"
      accessibilityLabel={`${UI_MESSAGES.AUTH.HAVE_ACCOUNT} ${UI_MESSAGES.ONBOARDING.LOG_IN}`}
      hitSlop={8}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ThemedText type="small" themeColor="textSecondary">
        {UI_MESSAGES.AUTH.HAVE_ACCOUNT}
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.logIn, { color: theme.primary }]}>
        {UI_MESSAGES.ONBOARDING.LOG_IN}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TouchTarget - 16,
  },
  logIn: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
});
