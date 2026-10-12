/**
 * Metro's CSS support: the mobile app imports `src/global.css` (web-platform
 * font variables). `expo-env.d.ts` (generated on first `expo start`) normally
 * supplies this declaration; this file keeps `tsc --noEmit` green before that
 * file exists and is harmless alongside it.
 */
declare module '*.css';