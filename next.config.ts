import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolated QA builds against a local Supabase use a separate output dir (docs/ISOLATED_TESTS.md).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pre-launch modes (src/lib/site-url.ts): every response is `noindex` — matching the page meta (`noindex, follow`)
  // so headers and HTML never disagree. Crawling stays allowed (robots.ts) so the rule can be seen.
  async headers() {
    // Staff-only homepage preview (drafts): never indexed, never stored by any cache.
    const preview = {
      source: "/preview/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ],
    };
    const mode = (process.env.SITE_PRELAUNCH || "").trim().toLowerCase();
    if (!["1", "true", "seo", "restricted"].includes(mode)) return [preview];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }, preview];
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
