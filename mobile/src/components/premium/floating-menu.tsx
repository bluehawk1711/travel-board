import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/premium/glass';
import { Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface FloatingAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Destructive actions render with the danger tint. */
  danger?: boolean;
}

/**
 * Expanding floating action menu (inspired by Slack's gesture menu, rebuilt on
 * Liquid Glass + reanimated). Collapsed it's a single glass FAB; on tap it
 * springs open a vertical stack of labelled glass actions with a staggered
 * entrance. The host screen positions it (e.g. bottom-right above the dock).
 */
export function FloatingActionMenu({
  actions,
  trigger = 'add',
  bottom = 0,
  accessibilityLabel = 'Open actions',
}: {
  actions: FloatingAction[];
  trigger?: keyof typeof Ionicons.glyphMap;
  /** Distance from the bottom edge (add safe-area inset yourself if needed). */
  bottom?: number;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const open = useSharedValue(0);
  const hasActions = actions.length > 0;

  // `open` is intentionally only touched in event handlers (never inside an
  // effect) so Reanimated's immutability rule stays happy. With no actions to
  // reveal there is nothing to open, so the trigger becomes a no-op.
  const toggle = () => {
    if (!hasActions) return;
    open.value = withSpring(open.value === 1 ? 0 : 1, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
  };

  const triggerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(open.value, [0, 1], [0, 135])}deg` },
      { scale: interpolate(open.value, [0, 1], [1, 0.92]) },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(open.value * 0.35, { duration: 180 }),
  }));

  const resolvedBottom = bottom + Math.max(insets.bottom, Spacing.three);

  return (
    <>
      {/* Dim backdrop that swallows taps to dismiss. */}
      <Animated.View
        pointerEvents={open.value === 1 ? 'auto' : 'none'}
        style={[styles.backdrop, { backgroundColor: '#000' }, backdropStyle]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={toggle} />
      </Animated.View>

      <View style={[styles.wrap, { bottom: resolvedBottom }]} pointerEvents="box-none">
        {/* Action stack */}
        <View style={styles.stack} pointerEvents={open.value === 1 ? 'auto' : 'none'}>
          {actions.map((action, index) => (
            <ActionRow
              key={action.key}
              action={action}
              index={index}
              total={actions.length}
              open={open}
              onSelect={() => {
                toggle();
                // Let the close animation start before the host reacts.
                setTimeout(action.onPress, 120);
              }}
            />
          ))}
        </View>

        {/* Trigger */}
        <Animated.View style={triggerStyle}>
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ expanded: open.value === 1 }}
          >
            <GlassSurface
              radius={30}
              tint={`${theme.primary}EE`}
              intensity={40}
              variant="regular"
              style={[styles.trigger, Shadows.fab]}
            >
              <Ionicons name={trigger} size={28} color={theme.onPrimary} />
            </GlassSurface>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}

function ActionRow({
  action,
  index,
  total,
  open,
  onSelect,
}: {
  action: FloatingAction;
  index: number;
  total: number;
  open: { value: number };
  onSelect: () => void;
}) {
  const theme = useTheme();
  // Stagger upward from the trigger: the closest action animates first.
  const delay = (total - 1 - index) * 45;

  const animated = useAnimatedStyle(() => ({
    opacity: withDelay(delay, withTiming(open.value, { duration: 160 })),
    transform: [
      {
        translateY: withDelay(
          delay,
          withSpring(interpolate(open.value, [0, 1], [24, 0]), {
            damping: 18,
            stiffness: 240,
          }),
        ),
      },
      {
        scale: withDelay(
          delay,
          withTiming(interpolate(open.value, [0, 1], [0.8, 1]), {
            easing: Easing.out(Easing.cubic),
          }),
        ),
      },
    ],
  }));

  const color = action.danger ? theme.danger : theme.text;

  return (
    <Animated.View style={[styles.row, animated]}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        style={({ pressed }) => [pressed && styles.rowPressed]}
      >
        <GlassSurface radius={18} tint={`${theme.surfaceCard}F0`} intensity={30} style={styles.rowSurface}>
          <View style={[styles.rowIcon, { backgroundColor: `${theme.backgroundElement}` }]}>
            <Ionicons name={action.icon} size={18} color={color} />
          </View>
          <Animated.Text numberOfLines={1} style={[styles.rowLabel, { color: theme.text }]}>
            {action.label}
          </Animated.Text>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  wrap: {
    position: 'absolute',
    right: Spacing.three,
    alignItems: 'flex-end',
  },
  stack: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
    alignItems: 'flex-end',
  },
  trigger: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {},
  rowPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  rowSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.half,
    minWidth: 168,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
});
