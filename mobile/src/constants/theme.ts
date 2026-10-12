/**
 * Terra Nova Travel design tokens (see
 * `stitch_travel_board_ui/terra_nova_travel/DESIGN.md`).
 *
 * Warm parchment surfaces, terracotta accents, photography-forward cards.
 * The colors are defined in the light and dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { THEME } from '@travel-board/shared';

function color<K extends keyof typeof THEME.colors>(
  token: K,
  mode: 'light' | 'dark',
): string {
  return THEME.colors[token][mode];
}

export const Colors = {
  light: {
    text: color('foreground', 'light'),
    background: color('background', 'light'),
    backgroundElement: color('secondary', 'light'),
    backgroundSelected: color('border', 'light'),
    textSecondary: color('mutedForeground', 'light'),
    surfaceCard: color('surface', 'light'),
    primary: color('primary', 'light'),
    primaryDark: color('primary', 'light'),
    primaryContainer: color('primaryContainer', 'light'),
    onPrimary: color('primaryForeground', 'light'),
    tertiary: color('success', 'light'),
    tertiaryLight: color('successContainer', 'light'),
    borderSubtle: color('border', 'light'),
    scrim: color('scrim', 'light'),
    overlay: 'rgba(25, 23, 22, 0.45)',
    danger: color('destructive', 'light'),
  },
  dark: {
    text: color('foreground', 'dark'),
    background: color('background', 'dark'),
    backgroundElement: color('secondary', 'dark'),
    backgroundSelected: color('border', 'dark'),
    textSecondary: color('mutedForeground', 'dark'),
    surfaceCard: color('surface', 'dark'),
    primary: color('primary', 'dark'),
    primaryDark: color('primary', 'dark'),
    primaryContainer: color('primaryContainer', 'dark'),
    onPrimary: color('primaryForeground', 'dark'),
    tertiary: color('success', 'dark'),
    tertiaryLight: color('successContainer', 'dark'),
    borderSubtle: color('border', 'dark'),
    scrim: color('scrim', 'dark'),
    overlay: 'rgba(0, 0, 0, 0.5)',
    danger: color('destructive', 'dark'),
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ── Fonts ────────────────────────────────────────────────────────────────
// Platform-specific font family selection. The shared `THEME.fonts.sans` is
// "Plus Jakarta Sans", but on iOS that maps to the system-ui family which
// includes the bundled San Francisco; we keep the same visual weight.

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// ── Spacing ──────────────────────────────────────────────────────────────
// 1:1 from `shared/THEME.spacing`. Mobile `Spacing` uses a `one`/`two`...
// naming; the values map exactly.

export const Spacing = {
  half: THEME.spacing.half,
  one: THEME.spacing.xs,
  two: THEME.spacing.sm,
  three: THEME.spacing.md,
  four: THEME.spacing.lg,
  five: THEME.spacing.xl,
  six: THEME.spacing['2xl'],
} as const;

// ── Radius ───────────────────────────────────────────────────────────────
// 1:1 from `shared/THEME.radii`.

export const Radius = {
  sm: THEME.radii.sm,
  md: THEME.radii.md,
  lg: THEME.radii.lg,
  xl: THEME.radii.xl,
  xxl: THEME.radii['2xl'],
  full: THEME.radii.full,
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────
// Platform-specific shadow presets derived from `shared/THEME.shadows`.
// Mobile needs RN shadow objects (shadowColor/Offset/Opacity/Radius +
// Android elevation); web uses the CSS strings from shared.

export const Shadows = Platform.select({
  ios: {
    card: {
      shadowColor: '#1C1410',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 3,
    },
    nav: {
      shadowColor: '#231712',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 36,
      elevation: 8,
    },
    fab: {
      shadowColor: '#FA5438',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.42,
      shadowRadius: 24,
      elevation: 10,
    },
  },
  android: {
    card: {
      shadowColor: '#1C1410',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 3,
    },
    nav: {
      shadowColor: '#231712',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 36,
      elevation: 8,
    },
    fab: {
      shadowColor: '#FA5438',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.42,
      shadowRadius: 24,
      elevation: 10,
    },
  },
  default: {
    card: {
      shadowColor: '#1C1410',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 3,
    },
    nav: {
      shadowColor: '#231712',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 36,
      elevation: 8,
    },
    fab: {
      shadowColor: '#FA5438',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.42,
      shadowRadius: 24,
      elevation: 10,
    },
  },
});

// ── Layout tokens ────────────────────────────────────────────────────────

/** Minimum touch target from DESIGN.md (48dp height). */
export const TouchTarget = THEME.touchTarget;

/** Bottom tab bar inset per platform (mobile only). */
export const BottomTabInset =
  (Platform.OS === 'ios' ? THEME.bottomTabInset.ios : THEME.bottomTabInset.android) ??
  0;

/** Max content width for centered layouts (px). */
export const MaxContentWidth = THEME.maxContentWidth;
