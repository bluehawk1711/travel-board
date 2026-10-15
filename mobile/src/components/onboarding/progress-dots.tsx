import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ProgressDotsProps {
  count: number;
  activeIndex: number;
}

/**
 * Carousel position indicator: the active step stretches into a pill
 * (mockup `rounded-full h-2 w-7`), inactive steps stay as small dots.
 */
export function ProgressDots({ count, activeIndex }: ProgressDotsProps) {
  const theme = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: activeIndex + 1 }}
    >
      {Array.from({ length: count }, (_, i) => {
        const active = i === activeIndex;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              active ? styles.active : null,
              {
                backgroundColor: active ? theme.primary : theme.backgroundSelected,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  active: {
    width: 28,
  },
});
