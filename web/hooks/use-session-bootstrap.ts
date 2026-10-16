"use client";

import { useEffect } from "react";
import {
  getAccessToken,
  notifyAuthChanged,
  refreshAccessToken,
} from "@/lib/auth";

/** Mirrors the marker cookie written by `setSessionMarker` in lib/auth.ts. */
const SESSION_MARKER = "tb_auth";

function hasSessionMarker(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${SESSION_MARKER}=1`));
}

/**
 * Restores the in-memory access token after a full page reload.
 *
 * The access token is deliberately in-memory only (lib/auth.ts), so a hard
 * refresh leaves `useSignedIn()` false even though the httpOnly refresh
 * cookie is still valid — protected pages gated on `enabled: signedIn`
 * would otherwise spin forever. On boot, if the session marker cookie says
 * "this browser has a session" but no token is loaded, refresh once and
 * broadcast `tb:auth` so subscribers (header, settings, chat) re-read.
 */
export function useSessionBootstrap(): void {
  useEffect(() => {
    if (getAccessToken() || !hasSessionMarker()) return;
    void refreshAccessToken().then((token) => {
      // Failure already dispatches `tb:auth: logout` inside refreshAccessToken.
      if (token) notifyAuthChanged("login");
    });
  }, []);
}
