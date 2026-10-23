import type { MetadataRoute } from "next";
import { isPrelaunch, siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  if (isPrelaunch()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/order/", "/checkout", "/cart", "/track-order", "/search"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
