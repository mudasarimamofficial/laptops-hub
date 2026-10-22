import type { MetadataRoute } from "next";
import { getV5Catalog, V5_COLS } from "@/lib/catalog/v5";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;

/** Public, indexable URLs only: no admin, order, checkout, cart, filtered or draft pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const P = await getV5Catalog().catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...Object.entries(V5_COLS)
      .filter(([, c]) => !c.hidden)
      .map(([id]) => ({ url: `${base}/collections/${id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...P.map((p) => ({ url: `${base}/products/${p.h}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/guides`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
