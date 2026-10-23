/**
 * Request routing in restricted pre-launch mode (SITE_PRELAUNCH=restricted). Pure, so it is unit-tested.
 *
 * - allow:      admin pages/APIs (staff work continues), secret-protected cron, framework assets, robots/sitemap,
 *               local images.
 * - comingSoon: every storefront page is rewritten to /coming-soon (HTTP 200, noindex).
 * - blockApi:   public catalog/checkout/contact APIs answer 503 — they would expose the catalog the page hides.
 * - blockImage: the image optimiser only serves local images, never the remote catalog photos.
 */
export type PrelaunchDecision = "allow" | "comingSoon" | "blockApi" | "blockImage";

const ALLOW_PREFIXES = ["/admin", "/api/admin", "/api/cron", "/_next/static", "/_next/webpack-hmr", "/v5/"];
const ALLOW_EXACT = new Set(["/coming-soon", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/manifest.webmanifest"]);

export function prelaunchDecision(pathname: string, searchParams: URLSearchParams): PrelaunchDecision {
  if (pathname === "/_next/image") {
    const src = searchParams.get("url") || "";
    return src.startsWith("/") && !src.startsWith("//") ? "allow" : "blockImage";
  }
  if (ALLOW_EXACT.has(pathname)) return "allow";
  if (ALLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) return "allow";
  if (pathname === "/api" || pathname.startsWith("/api/")) return "blockApi";
  return "comingSoon";
}
