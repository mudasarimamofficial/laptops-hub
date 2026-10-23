import type { MetadataRoute } from "next";
import { isPrelaunch, siteUrl } from "@/lib/site-url";

/** Private and transactional routes are never crawled (they are also noindex or behind sign-in). */
export const PRIVATE_PATHS = ["/admin/", "/api/", "/order/", "/checkout", "/cart", "/track-order", "/search"];

export default function robots(): MetadataRoute.Robots {
  // Pre-launch: public pages stay crawlable so search engines can read their `noindex` (a robots.txt block would
  // hide it); no sitemap is advertised.
  if (isPrelaunch()) return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
