import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Board cover images are user-generated (Cloudflare R2 or external URLs), so
  // allow optimization for any https/http host.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Compile the repo-level `shared/` brand & token module.
  transpilePackages: ["@travel-board/shared"],
  turbopack: {
    resolveAlias: {
      "@shared": ["../shared"],
    },
  },
  outputFileTracingIncludes: {
    "/**": ["../shared/**/*"],
  },
};

export default nextConfig;