import { Aurora } from 'react-native-effects';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Motion + shader primitives.
 *
 * - `Reveal` wraps a block in a staggered fade/rise entrance (reanimated
 *   layout animations). Cheap, runs on the UI thread, and stacks nicely down a
 *   scroll view by increasing `delay`.
 * - `Dissolve` renders an animated Aurora shader behind its children — the
 *   premium "living gradient" look — and falls back to a static tinted panel
 *   on web/older devices where the Skia runtime is unavailable.
 */

export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay)
        .duration(420)
        .springify()
        .damping(18)
        .stiffness(160)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Simple fade+scale for modals / overlays. */
export function FadeInScale({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(240)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Living-gradient panel. Uses the Skia Aurora shader on native for a premium,
 * slowly drifting tint; falls back to a flat tinted surface elsewhere.
 */
export function Dissolve({
  children,
  color,
  speed = 0.4,
  intensity = 0.9,
  style,
}: {
  children?: ReactNode;
  /** Base tint for the shader (and the fallback surface). */
  color?: string;
  speed?: number;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const tint = color ?? theme.primary;

  // Skia-backed shaders are native-only; web gets a static tinted surface.
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[{ backgroundColor: `${tint}22`, borderRadius: 24, overflow: 'hidden' }, style]}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[{ borderRadius: 24, overflow: 'hidden' }, style]}
    >
      <Aurora
        color={tint}
        speed={speed}
        intensity={intensity}
        layers={3}
        style={StyleSheetFill}
      />
      {children}
    </Animated.View>
  );
}

const StyleSheetFill = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};
