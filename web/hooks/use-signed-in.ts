"use client";

import { useSyncExternalStore } from "react";
import { getAccessToken } from "@/lib/auth";

function subscribe(callback: () => void) {
  window.addEventListener("tb:auth", callback);
  return () => window.removeEventListener("tb:auth", callback);
}

/**
 * Whether a client-side session exists.
 *
 * Uses `useSyncExternalStore` so the server snapshot (and the hydration render)
 * is always `false` — the token lives in memory, so reading it during SSR would
 * cause a hydration mismatch. This avoids the usual
 * "setState inside useEffect" dance entirely.
 */
export function useSignedIn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !!getAccessToken(),
    () => false,
  );
}
