import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Liquid Glass primitives.
 *
 * On iOS 26+ we render the real system Liquid Glass (`GlassView`). Everywhere
 * else — older iOS, Android, and web — we fall back to a translucent tinted
 * blur so the premium "floating glass" look degrades gracefully instead of
 * crashing or rendering as a flat box.
 */

/** True when the native Liquid Glass API is available (iOS 26+). */
export function useGlassAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

type GlassSurfaceProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius (applies to both glass + fallback). */
  radius?: number;
  /** Tint applied over the backdrop. */
  tint?: string;
  /** Fallback blur intensity (Android/web/older iOS). */
  intensity?: number;
  /** 'clear' for chrome-like controls, 'regular' for surfaces. */
  variant?: 'clear' | 'regular';
  interactive?: boolean;
};

/**
 * A rounded "glass" container. Uses the system Liquid Glass when available and
 * falls back to a tinted BlurView elsewhere. Children render on top.
 */
export function GlassSurface({
  children,
  style,
  radius = 24,
  tint,
  intensity = 24,
  variant = 'regular',
  interactive = true,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const glass = useGlassAvailable();

  if (glass) {
    return (
      <GlassView
        style={[{ borderRadius: radius }, style]}
        glassEffectStyle={variant}
        tintColor={tint ?? 'rgba(255,255,255,0.14)'}
        isInteractive={interactive}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity}
        tint={Platform.OS === 'android' ? 'light' : 'default'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint ?? `${theme.surfaceCard}CC`, borderRadius: radius },
        ]}
      />
      {children}
    </View>
  );
}

/**
 * A round glass control (back button, share, overflow, FAB). Children are the
 * icon. Press feedback is handled by the caller via Pressable.
 */
export function GlassButton({
  children,
  size = 44,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface
      radius={size / 2}
      tint="rgba(255,255,255,0.18)"
      intensity={40}
      variant="clear"
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <GlassPressable onPress={onPress} label={accessibilityLabel}>
        {children}
      </GlassPressable>
    </GlassSurface>
  );
}

// Tiny internal pressable so GlassButton stays a pure layout wrapper.
function GlassPressable({
  children,
  onPress,
  label,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}
