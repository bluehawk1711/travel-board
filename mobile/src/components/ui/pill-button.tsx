import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PillVariant = 'primary' | 'secondary' | 'ghost';

/**
 * Terra Nova pill button (DESIGN.md §Buttons): fully rounded, saturated
 * terracotta primary, warm sand secondary, bordered ghost. Minimum 48dp touch
 * target. One implementation for the whole app — screens never hand-roll
 * button styles.
 */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: PillVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Chips/compact controls: 36dp instead of the 48dp touch target. */
  compact?: boolean;
  style?: object;
}) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const background =
    variant === 'primary'
      ? theme.primary
      : variant === 'secondary'
        ? theme.backgroundElement
        : 'transparent';
  const color =
    variant === 'primary'
      ? theme.onPrimary
      : variant === 'secondary'
        ? theme.text
        : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          minHeight: compact ? 36 : TouchTarget,
          paddingHorizontal: compact ? Spacing.three : Spacing.four,
        },
        variant === 'primary' && !inactive ? Shadows.fab : null,
        variant === 'ghost' && { borderWidth: 1.5, borderColor: theme.borderSubtle },
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Category filter chip (DESIGN.md §Chips): active = on-surface fill. */
export function Chip({
  label,
  active,
  onPress,
  accent,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Optional active tint (e.g. tertiary for "confirmed"). */
  accent?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const background = active ? (accent ?? theme.text) : theme.surfaceCard;
  const color = active ? (accent ? theme.text : theme.background) : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: background,
          borderColor: active ? 'transparent' : theme.borderSubtle,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Small rounded status badge (e.g. "Itinerary", "Private", "Top Pick"). */
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'tertiary' | 'glass';
}) {
  const theme = useTheme();
  const map = {
    neutral: { bg: theme.backgroundElement, fg: theme.textSecondary },
    primary: { bg: theme.primaryContainer, fg: theme.primaryDark },
    tertiary: { bg: theme.tertiaryLight, fg: theme.tertiary },
    glass: { bg: theme.overlay, fg: '#FFFFFF' },
  } as const;
  const { bg, fg } = map[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color: fg }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});