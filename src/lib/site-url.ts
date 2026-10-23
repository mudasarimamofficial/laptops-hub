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
 * Pre-launch mode (SITE_PRELAUNCH=1): the site stays reachable but asks search engines not to index it — robots.txt
 * disallows everything, the sitemap is empty and every response carries X-Robots-Tag (next.config.ts). Off by
 * default; changing it on Vercel needs a redeploy.
 */
export function isPrelaunch() {
  return process.env.SITE_PRELAUNCH === "1";
}
