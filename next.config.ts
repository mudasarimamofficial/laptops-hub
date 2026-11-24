import type { NextConfig } from "next";

/**
 * Baseline security headers on every response. Deliberately conservative so nothing on the storefront breaks:
 * SAMEORIGIN (not DENY) because the admin theme editor embeds the staff preview in an iframe; the Permissions-Policy
 * only switches off device features the store never uses. A Content-Security-Policy is NOT set yet — it needs its own
 * tested rollout (Google Maps embed, external reel video hosts, Shopify CDN images); see the handover security doc.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework in every response.
  poweredByHeader: false,
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
    const security = { source: "/:path*", headers: SECURITY_HEADERS };
    const mode = (process.env.SITE_PRELAUNCH || "").trim().toLowerCase();
    if (!["1", "true", "seo", "restricted"].includes(mode)) return [security, preview];
    return [security, { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }, preview];
  },
  images: {
    // Prefer modern formats when next/image is used (admin + selective storefront).
    // Storefront catalog cards use Shopify CDN width= params (free-plan safe; no Supabase transforms).
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 420, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 320, 384, 480],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "**.myshopify.com" },
      // External reel posters/avatars (e.g. Shopify CDN on third-party shops) — HTTPS only.
      { protocol: "https", hostname: "ronin.pk" },
      { protocol: "https", hostname: "**.ronin.pk" },
    ],
  },
};

export default nextConfig;
