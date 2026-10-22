import type { MetadataRoute } from "next";
import { getV5Catalog, V5_COLS } from "@/lib/catalog/v5";
import { siteUrl } from "@/lib/site-url";
import { contentVisibility, previewAllContent } from "@/lib/content/pages";

export const revalidate = 3600;

/** Public, indexable URLs only: no admin, order, checkout, cart, filtered or draft pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const P = await getV5Catalog().catch(() => []);
  // Content pages and guides only once published (and legally approved); never preview-only content.
  const vis = previewAllContent() ? { pages: {}, articles: {} } : await contentVisibility();
  const pages = Object.entries(vis.pages).filter(([, v]) => v).map(([k]) => k);
  const articles = Object.entries(vis.articles).filter(([, v]) => v).map(([k]) => k);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...Object.entries(V5_COLS)
      .filter(([, c]) => !c.hidden)
      .map(([id]) => ({ url: `${base}/collections/${id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...P.map((p) => ({ url: `${base}/products/${p.h}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.3 },
    ...pages.map((k) => ({ url: `${base}/pages/${k}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...(articles.length ? [{ url: `${base}/guides`, changeFrequency: "monthly" as const, priority: 0.3 }] : []),
    ...articles.map((k) => ({ url: `${base}/guides/${k}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
