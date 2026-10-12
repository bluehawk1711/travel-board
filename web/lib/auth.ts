/**
 * Client-side JWT token management for the web app.
 *
 * Access tokens are stored in-memory only (never localStorage) for use by
 * the Socket.IO handshake and REST calls. Refresh tokens live in httpOnly
 * cookies set by the backend — invisible to JavaScript.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** In-memory access token (survives SPA navigations, lost on full reload). */
let accessToken: string | null = null;

let refreshPromise: Promise<string | null> | null = null;

/**
 * Non-sensitive marker cookie read by `proxy.ts` (edge guard). The real tokens
 * stay httpOnly; this only records "this browser has a session" so protected
 * routes don't bounce signed-in users to /login.
 */
const SESSION_MARKER = 'tb_auth';

function setSessionMarker(present: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = present
    ? `${SESSION_MARKER}=1; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`
    : `${SESSION_MARKER}=; path=/; max-age=0; samesite=lax`;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function storeTokens(access: string, _refresh: string): void {
  accessToken = access;
  // Refresh token is in the httpOnly cookie — we never store it in JS.
  setSessionMarker(true);
}

export function clearTokens(): void {
  accessToken = null;
  setSessionMarker(false);
}

/**
 * Broadcasts a token change so client components (header, chat) can react
 * without a full page reload. `login` | `logout`.
 */
export function notifyAuthChanged(event: 'login' | 'logout'): void {
  window.dispatchEvent(new CustomEvent('tb:auth', { detail: { event } }));
}

/**
 * Attempt to refresh the access token by calling the backend refresh endpoint.
 * The httpOnly refresh cookie is sent automatically with `credentials: 'include'`.
 * Deduplicates concurrent calls — all callers share the same promise.
 * Returns the new access token on success, or null on failure (caller
 * should redirect to login).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // send httpOnly cookies
        headers: { 'Content-Type': 'application/json' },
        body: '{}', // empty body — cookie has the refresh token
      });
      if (!res.ok) {
        clearTokens();
        notifyAuthChanged('logout');
        return null;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      clearTokens();
      notifyAuthChanged('logout');
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
