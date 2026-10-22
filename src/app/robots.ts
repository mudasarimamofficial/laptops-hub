import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/order/", "/checkout", "/cart", "/track-order", "/search"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
