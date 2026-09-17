import { QueryClient } from '@tanstack/react-query';

/**
 * staleTime aligned to the API's feed TTLs (60s — architecture.md §5.4):
 * repeated visits within a minute reuse the in-memory copy instead of
 * hammering the API.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});