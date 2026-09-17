"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { storeTokens } from "@/lib/auth";

/**
 * Target of the API's Google OAuth redirect (`FRONTEND_URL/auth/callback`).
 * The API sets httpOnly cookies for both tokens and also includes the access
 * token as a query param so we can store it in memory (for Socket.IO handshake).
 * We immediately clean the URL to remove the token from browser history.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    if (accessToken) {
      // Store access token in memory (refresh token is in httpOnly cookie).
      storeTokens(accessToken, "");
      // Clean the URL so the token isn't in browser history.
      window.history.replaceState({}, "", "/auth/callback");
    }
    router.replace("/");
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Signing you in…
      </p>
    </main>
  );
}
