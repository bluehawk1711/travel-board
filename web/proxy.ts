import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge route guard (Next 16 `proxy.ts`, formerly `middleware.ts`).
 *
 * Authed routes redirect anonymous visitors to /login. We can't verify the JWT
 * here (the refresh cookie is httpOnly and scoped to the API origin), so this
 * is a *cheap first gate* — the API still enforces every permission. The
 * `tb_auth` marker cookie is set by the client on login so the check works even
 * when the web app and API live on different hosts.
 */
const PROTECTED_PREFIXES = [
  "/boards",
  "/settings",
  "/following",
  "/onboarding",
  "/chat",
];

const SESSION_COOKIES = ["tb_access_token", "tb_refresh_token", "tb_auth"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some(
    (name) => Boolean(request.cookies.get(name)?.value),
  );
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/boards/:path*",
    "/settings/:path*",
    "/following/:path*",
    "/onboarding/:path*",
    "/chat/:path*",
  ],
};
