import { QueryClient } from '@tanstack/react-query';

/**
 * Cache tuning for the mobile client.
 *
 * - `staleTime` (60s) matches the API's feed cache TTLs (architecture.md §5.4):
 *   revisiting a screen within a minute reuses the in-memory copy instead of
 *   re-hitting the API.
 * - `gcTime` (5 min) keeps inactive queries — e.g. a feed you just scrolled
 *   away from — in memory so navigating back is instant rather than refetching
 *   from a cold cache.
 * - Refetch-on-focus/mount defaults are left off so tab switches don't trigger
 *   a request storm; screens opt into explicit `refetchInterval` where it
 *   matters (e.g. unread badge, presence).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
