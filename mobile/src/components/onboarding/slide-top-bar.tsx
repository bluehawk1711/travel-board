import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { Spacing } from '@/constants/theme';

export interface SlideTopBarProps {
  /** Leading slot: brand mark or back button. */
  leading?: ReactNode;
  /** Center slot: progress dots or step counter. */
  center?: ReactNode;
  /** Trailing slot: skip action. */
  trailing?: ReactNode;
}

/**
 * Fixed top bar of an onboarding slide. Side slots get equal min widths so
 * the center content stays optically centered between them.
 */
export function SlideTopBar({ leading, center, trailing }: SlideTopBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>{leading}</View>
      {center ? <View style={styles.center}>{center}</View> : null}
      <View style={[styles.side, styles.sideTrailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  side: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sideTrailing: {
    alignItems: 'flex-end',
  },
  center: {
    alignItems: 'center',
  },
});
