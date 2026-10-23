/**
 * Absolute origin for canonical URLs, sitemap and Open Graph: SITE_URL, else on Vercel Production the project's
 * production domain (VERCEL_PROJECT_PRODUCTION_URL — the per-deployment VERCEL_URL is behind Vercel SSO), else the
 * deployment URL.
 */
export function siteUrl() {
  const explicit = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Site mode, from SITE_PRELAUNCH (read at build time on Vercel: changing it needs a redeploy).
 * - "launch" (unset): normal indexing, canonical URLs and sitemap.
 * - "prelaunch" (`1`): storefront visible with a pre-launch notice; every page is `noindex` (meta + X-Robots-Tag)
 *   and crawlable, so search engines can see the rule; no sitemap, no canonical links.
 * - "restricted" (`restricted`): storefront pages, public catalog APIs and remote image optimisation are replaced
 *   by a coming-soon page (src/middleware.ts); admin keeps working. Same indexing rules as "prelaunch".
 * `noindex` is not access control: only "restricted" hides storefront pages, and neither mode hides data the
 * public Supabase API or the image CDN serve directly.
 */
export type SiteMode = "launch" | "prelaunch" | "restricted";

export function siteMode(value = process.env.SITE_PRELAUNCH): SiteMode {
  const v = (value || "").trim().toLowerCase();
  if (v === "restricted") return "restricted";
  if (v === "1" || v === "true" || v === "seo") return "prelaunch";
  return "launch";
}

/** True in both pre-launch modes: pages are noindex and no sitemap/canonical is advertised. */
export function isPrelaunch() {
  return siteMode() !== "launch";
}

/** `alternates` for page metadata: the canonical path in launch mode, none while pages are noindex. */
export function canonicalFor(path: string): { canonical: string } | undefined {
  return isPrelaunch() ? undefined : { canonical: path };
}

/**
 * Page-level `robots`: noindex (still followable) when the page itself is not indexable or while pre-launch,
 * otherwise inherit the layout's. Pages must use this instead of `cond ? {...} : undefined` — an explicit
 * `robots: undefined` replaces the layout's pre-launch noindex.
 */
export function robotsFor(noindex: boolean) {
  return noindex || isPrelaunch() ? { index: false, follow: true } : undefined;
}
