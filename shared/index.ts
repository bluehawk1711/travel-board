/**
 * Travel Board — shared brand & design tokens.
 *
 * Single source of truth for values that must stay in sync across the
 * NestJS API, the Next.js web app, and the Expo mobile app: app identity,
 * version, and the Terra Nova Travel design language
 * (see `stitch_travel_board_ui/terra_nova_travel/DESIGN.md`).
 *
 * Platform-specific token *implementations* (CSS variables in
 * `web/app/globals.css`, React Native objects in `mobile/src/constants/theme.ts`)
 * are derived from these values — update here first.
 */

export const APP = {
  name: 'Travel Board',
  tagline: 'Discover, plan, and share trips together',
  description:
    'Travel Board is a Pinterest-style social platform where people discover, create, save, and collaboratively plan trips through shareable travel boards.',
  /** Semantic version, mirrored in mobile/app.json and web/package.json. */
  version: '1.0.0',
  companyName: 'Travel Board',
  supportEmail: 'support@travelboard.app',
  urls: {
    web: 'https://travelboard.app',
    privacy: 'https://travelboard.app/privacy',
    terms: 'https://travelboard.app/terms',
  },
} as const;

/**
 * Terra Nova Travel core palette. Hex values here are the *light mode*
 * canonical colors; dark variants live in each platform's theme
 * implementation (globals.css / theme.ts) but must map 1:1 to these keys.
 */
export const BRAND_COLORS = {
  /** Canvas — warm parchment page background. */
  background: '#FAF9F6',
  /** Primary text — warm slate. */
  text: '#191716',
  /** Terracotta — the brand accent. */
  primary: '#FA5438',
  primaryDark: '#D93D22',
  primaryContainer: '#FFECE8',
  /** Confirmed/success green (trip status, live presence). */
  tertiary: '#0E7453',
  /** Destructive / error red. */
  danger: '#BA1A1A',
} as const;

/**
 * Semantic design tokens — the single source of truth for both web (Tailwind 4
 * CSS variables) and mobile (React Native theme objects). Both clients derive
 * their concrete values from this dictionary, so changing a token here updates
 * every surface across all three apps.
 *
 * Dark-mode variants are per-token; platforms pick light or dark based on the
 * user's `themeMode` setting (`user_settings.theme_mode`: SYSTEM | LIGHT | DARK).
 */
export const THEME = {
  colors: {
    /** Page/screen background. */
    background: { light: '#FAF9F6', dark: '#141210' },
    /** Primary foreground text. */
    foreground: { light: '#191716', dark: '#FAF9F6' },
    /** Card/popover surface. */
    surface: { light: '#FFFFFF', dark: '#1C1917' },
    /** Slightly elevated surface (nested cards, inputs). */
    surfaceElevated: { light: '#F4F2ED', dark: '#221F1D' },
    /** Primary action color (terracotta). Same in both modes. */
    primary: { light: '#FA5438', dark: '#FA5438' },
    /** Primary foreground on primary (white). */
    primaryForeground: { light: '#FFFFFF', dark: '#FFFFFF' },
    /** Primary container (tinted terracotta for hover/selected). */
    primaryContainer: { light: '#FFECE8', dark: '#3A1A13' },
    /** Secondary/muted surface. */
    secondary: { light: '#F4F2ED', dark: '#221F1D' },
    secondaryForeground: { light: '#191716', dark: '#FAF9F6' },
    /** Muted text / placeholder. */
    muted: { light: '#F4F2ED', dark: '#221F1D' },
    mutedForeground: { light: '#6A645D', dark: '#A8A29B' },
    /** Accent (hover/selected tinted terracotta). */
    accent: { light: '#FFECE8', dark: '#3A1A13' },
    accentForeground: { light: '#D93D22', dark: '#FFB4A6' },
    /** Destructive/red. */
    destructive: { light: '#BA1A1A', dark: '#FFB4AB' },
    destructiveForeground: { light: '#FFFFFF', dark: '#690005' },
    /** Success/green (trip status, presence). */
    success: { light: '#0E7453', dark: '#4FB98C' },
    successForeground: { light: '#FFFFFF', dark: '#002113' },
    successContainer: { light: '#E3F7EE', dark: '#12352A' },
    /** Hairline borders / dividers. */
    border: { light: '#ECE8E1', dark: '#2E2A27' },
    /** Input background. */
    input: { light: '#ECE8E1', dark: '#2E2A27' },
    /** Focus ring. */
    ring: { light: '#FA5438', dark: '#FA5438' },
    /** Overlay/scrim on top of photography. */
    scrim: { light: 'rgba(25, 23, 22, 0.55)', dark: 'rgba(0, 0, 0, 0.6)' },
  },
  /** Corner radii (px). */
  radii: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 20,
    '2xl': 24,
    full: 9999,
  } as const,
  /** Spacing scale (px). Matches mobile `Spacing` + web Tailwind spacing. */
  spacing: {
    half: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 64,
  } as const,
  /** Type scale (px). */
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  } as const,
  /** Font families. */
  fonts: {
    sans: 'Plus Jakarta Sans',
    mono: 'Geist Mono',
    sansStack: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
  },
  /** Shadow presets — warm-tinted ambient elevation, never neutral gray. */
  shadows: {
    card: {
      light: '0 8px 24px -4px rgba(28, 20, 16, 0.06), 0 2px 6px -1px rgba(28, 20, 16, 0.04)',
      dark: '0 8px 24px -4px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.3)',
    },
    nav: {
      light: '0 12px 36px -4px rgba(35, 23, 18, 0.12), 0 2px 8px 0 rgba(35, 23, 18, 0.04)',
      dark: '0 12px 36px -4px rgba(0, 0, 0, 0.5), 0 2px 8px 0 rgba(0, 0, 0, 0.3)',
    },
    fab: {
      light: '0 10px 24px -2px rgba(250, 84, 56, 0.42)',
      dark: '0 10px 24px -2px rgba(250, 84, 56, 0.5)',
    },
  },
  /** Minimum touch target (dp). */
  touchTarget: 48,
  /** Bottom tab bar inset per platform (mobile only, web ignores). */
  bottomTabInset: {
    ios: 50,
    android: 80,
    default: 0,
  },
  /** Max content width for centered layouts (px). */
  maxContentWidth: 800,
} as const;

/** User-selectable appearance. Stored in `user_settings.theme_mode`. */
export const THEME_MODES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Server-side settings shape shared by API, web and mobile. */
export interface UserSettings {
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  emailUpdates: boolean;
  /** Currency code used for budget display (e.g. "USD"). */
  currency: string;
}
