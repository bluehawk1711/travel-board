import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** API origin the browser talks to (REST + Socket.IO). */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const wsOrigin = apiOrigin.replace(/^http/, "ws");

/**
 * Security headers. The API runs helmet too, but the web app is a separate
 * origin and needs its own response policy (helmet's CSP is disabled there
 * because it only serves JSON).
 *
 * CSP note: `'unsafe-inline'` for scripts is required until we adopt a nonce
 * (nonce-based CSP forces dynamic rendering, which would defeat static
 * caching). Frame-ancestors, object-src and base-uri stay locked down.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      `connect-src 'self' ${apiOrigin} ${wsOrigin}`,
      "media-src 'self' https: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Board cover images are user-generated (Cloudflare R2 or external URLs), so
  // allow optimization for any https/http host.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // The shared package ships raw TS — compile it in the Next pipeline.
  transpilePackages: ["@travel-board/shared"],
  // `@travel-board/shared` resolves through node_modules (pnpm `file:` dep);
  // Turbopack on Windows cannot handle out-of-root resolveAlias targets.
  poweredByHeader: false,
    // React 19 cache components: enables partial hydration + `use cache` on server
  // components. Public read paths (explore shell, board metadata) can be cached
  // at the edge; authed pages stay dynamic (no `cookies()` in cache boundaries).
  cacheComponents: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;