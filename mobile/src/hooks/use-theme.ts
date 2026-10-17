/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeStore } from '@/lib/theme-store';

/**
 * Resolved light/dark scheme: the user's saved preference (Settings →
 * Appearance) wins, otherwise the OS setting.
 */
export function useResolvedScheme(): 'light' | 'dark' {
  const mode = useThemeStore((state) => state.mode);
  const system = useColorScheme();

  if (mode === 'LIGHT') return 'light';
  if (mode === 'DARK') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useResolvedScheme()];
}
