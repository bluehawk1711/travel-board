"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useSessionBootstrap } from "@/hooks/use-session-bootstrap";

/**
 * App-wide React Query provider. Defaults tuned for a feed-style app:
 * - staleTime 30s: avoids refetch storms on navigation
 * - retry 1: one silent retry, then surface the error
 * - no refetchOnWindowFocus: the API already serves Redis-cached feeds
 */
export function Providers({ children }: { children: ReactNode }) {
  // Rehydrate the in-memory access token from the httpOnly refresh cookie on
  // hard reloads — without this, auth-gated pages (settings, chat) spin forever.
  useSessionBootstrap();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
