import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassButton } from '@/components/premium/glass';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenHeaderProps = {
  title: string;
  /** Secondary line under the title. */
  subtitle?: string;
  /**
   * 'bar'   — compact navigation bar: glass back, centered title, right actions.
   * 'large' — big display title (tab roots: Profile, Messages, Search…).
   */
  variant?: 'bar' | 'large';
  /** Back chevron visibility (defaults: bar → true, large → false). */
  showBack?: boolean;
  /** Overrides the default `router.back()`. */
  onBack?: () => void;
  /** Right-hand controls (icon buttons, pills…). */
  actions?: ReactNode;
  /** Hairline under the bar (bar variant only). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one premium header used across the app — replaces the per-screen
 * hand-rolled top bars so spacing, type and the glass back control are
 * consistent everywhere.
 */
export function ScreenHeader({
  title,
  subtitle,
  variant = 'bar',
  showBack,
  onBack,
  actions,
  divider = false,
  style,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const router = useRouter();

  const back = showBack ?? variant === 'bar';
  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  if (variant === 'large') {
    return (
      <View style={[styles.large, style]}>
        <View style={styles.largeText}>
          <ThemedText style={styles.largeTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.largeSub} numberOfLines={2}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        divider && [styles.divider, { borderBottomColor: theme.borderSubtle }],
        style,
      ]}
    >
      <View style={styles.side}>
        {back ? (
          <GlassButton onPress={handleBack} accessibilityLabel="Go back">
            <Ionicons
              name={Platform.OS === 'android' ? 'arrow-back' : 'chevron-back'}
              size={22}
              color={theme.text}
            />
          </GlassButton>
        ) : null}
      </View>

      <View style={styles.center}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.barTitle}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact navigation bar — symmetric 44pt sides keep the title optically
  // centered regardless of which controls are present.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  side: { minWidth: 44, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', gap: 1 },
  barTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },

  // Large display header — iOS-style oversized title with optional actions.
  large: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  largeText: { flex: 1 },
  largeTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.9, lineHeight: 38 },
  largeSub: { marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
