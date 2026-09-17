/**
 * Terra Nova Travel design tokens (see
 * `stitch_travel_board_ui/terra_nova_travel/DESIGN.md`).
 *
 * Warm parchment surfaces, terracotta accents, photography-forward cards.
 * The colors are defined in the light and dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#191716',
    background: '#FAF9F6',
    backgroundElement: '#F4F2ED',
    backgroundSelected: '#ECE8E1',
    textSecondary: '#6A645D',
    /** Elevated white card surface. */
    surfaceCard: '#FFFFFF',
    /** Terracotta — primary actions, active states, save counts. */
    primary: '#FA5438',
    primaryDark: '#D93D22',
    primaryContainer: '#FFECE8',
    onPrimary: '#FFFFFF',
    /** Confirmed / success accents (trip status, live presence). */
    tertiary: '#0E7453',
    tertiaryLight: '#E3F7EE',
    /** Hairline separators (1px, warm). */
    borderSubtle: '#ECE8E1',
    /** Overlays over photography + floating glass chips. */
    scrim: 'rgba(25, 23, 22, 0.55)',
    overlay: 'rgba(25, 23, 22, 0.45)',
    danger: '#BA1A1A',
  },
  dark: {
    text: '#FAF9F6',
    background: '#141210',
    backgroundElement: '#221F1D',
    backgroundSelected: '#2E2A27',
    textSecondary: '#A8A29B',
    surfaceCard: '#1C1917',
    primary: '#FA5438',
    primaryDark: '#D93D22',
    primaryContainer: '#3A1A13',
    onPrimary: '#FFFFFF',
    tertiary: '#4FB98C',
    tertiaryLight: '#12352A',
    borderSubtle: '#2E2A27',
    scrim: 'rgba(0, 0, 0, 0.6)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    danger: '#FFB4AB',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner scale from DESIGN.md: 16px baseline, 20–24px prominent surfaces. */
export const Radius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

/** Warm tinted ambient shadows — never neutral gray. */
export const Shadows = {
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
} as const;

/** Minimum touch target from DESIGN.md (48dp height). */
export const TouchTarget = 48;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
