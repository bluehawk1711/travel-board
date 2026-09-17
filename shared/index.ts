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
  danger: '#BA1A1A',
} as const;

export const FONT_FAMILY = {
  /** Plus Jakarta Sans across all platforms (see DESIGN.md typography). */
  sans: 'Plus Jakarta Sans',
  mono: 'Geist Mono',
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
