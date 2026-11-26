import type { ArticleSeo } from "@/lib/content/resolve";
import { SHARE_IMAGE_PATH } from "@/lib/seo/site-jsonld";

/**
 * Article markup for a published guide: only fields the merchant actually set (dates, author, image). The publisher is
 * the site business node (`/#organization`, see site-jsonld.ts). No ratings, no FAQ markup.
 */
export function articleJsonLd(origin: string, path: string, title: string, description: string, a: ArticleSeo | undefined) {
  const url = `${origin}${path}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: title.slice(0, 110),
    mainEntityOfPage: url,
    url,
    inLanguage: "en-PK",
    publisher: { "@id": `${origin}/#organization` },
    image: a?.image || `${origin}${SHARE_IMAGE_PATH}`,
  };
  if (description) data.description = description;
  if (a?.publishedAt) data.datePublished = a.publishedAt;
  if (a?.modifiedAt) data.dateModified = a.modifiedAt;
  data.author = a?.author ? { "@type": "Person", name: a.author } : { "@id": `${origin}/#organization` };
  // G18: blog taxonomy from Admin › Blog (only when set). News posts are NewsArticle.
  if (a?.category) data.articleSection = a.category;
  if (a?.tags?.length) data.keywords = a.tags.join(", ");
  if (a?.template === "news") data["@type"] = "NewsArticle";
  return data;
}

/** BreadcrumbList from (name, path) pairs; the last item is the current page. */
export function breadcrumbJsonLd(origin: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${origin}${it.path}` })),
  };
}
