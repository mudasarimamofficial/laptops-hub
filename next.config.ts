import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolated QA builds against a local Supabase use a separate output dir (docs/ISOLATED_TESTS.md).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pre-launch mode (src/lib/site-url.ts): reachable, but not indexed.
  async headers() {
    if (process.env.SITE_PRELAUNCH !== "1") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "**.myshopify.com" },
    ],
  },
};

export default nextConfig;
