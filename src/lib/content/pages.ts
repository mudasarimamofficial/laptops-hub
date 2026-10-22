import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { LEGAL_CONTENT_SLUGS } from "@/lib/security/sanitize-html";
import { V5_CONTENT } from "@/lib/content/v5-content";
import type { V5Page } from "@/lib/content/types";
import { previewAllContent, resolveContent as resolve, type ContentRow as Row, type ResolvedContent } from "@/lib/content/resolve";

export { previewAllContent, type ResolvedContent };

/**
 * Publication model for /pages/* and /guides/* (V5 `isPage` routes):
 *
 * - The CMS row is the source of truth. It is read with the anon key, so RLS decides visibility:
 *   `status = 'published'` and, for policy slugs, `legal_approved = true` (migration 20261021160000).
 * - Visible row with a body  → sanitized CMS HTML inside the V5 page shell.
 * - Visible row, empty body   → the V5 template content (publishing it in admin is the owner's approval).
 * - Not visible               → "gated": V5 shell with V5's customer-facing "being finalised" block, noindex.
 * - V5_CONTENT_PREVIEW=1 renders template content for QA/parity, and is ignored on Vercel Production.
 */
export const PAGE_SLUGS = Object.keys(V5_CONTENT.pages);
export const ARTICLE_SLUGS = V5_CONTENT.articles.map((a) => a.slug);

/** Publicly visible CMS rows (RLS-filtered), cached 60s under the `content` tag. */
const visibleRows = unstable_cache(
  async (): Promise<{ pages: Row[]; articles: Row[] }> => {
    const sb = createPublicClient();
    const [p, a] = await Promise.all([
      sb.from("content_pages").select("slug, title, body_html, status, legal_approved").eq("status", "published"),
      sb.from("articles").select("slug, title, body_html, status").eq("status", "published"),
    ]);
    return { pages: (p.data as Row[] | null) || [], articles: (a.data as Row[] | null) || [] };
  },
  ["v5-content-visible"],
  { revalidate: 60, tags: ["content"] },
);

export async function getContentPage(slug: string): Promise<ResolvedContent | null> {
  const tpl = V5_CONTENT.pages[slug];
  if (!tpl) return null;
  const rows = await visibleRows().catch(() => ({ pages: [], articles: [] }));
  return resolve(slug, tpl, rows.pages.find((r) => r.slug === slug), LEGAL_CONTENT_SLUGS.has(slug));
}

/** V5 guides index (built in `pageVals`, not part of lh-content). Public once any article is public. */
const GUIDES_INDEX: V5Page = {
  title: "Buying guides & laptop advice",
  kicker: "Guides",
  status: "draft",
  intro: "Short explainers on processors, memory, storage and laptop lines, linked to matching laptops in the catalog.",
  blocks: [
    { t: "articles" },
    { t: "cta", v: "Prefer a step-by-step guide?", sub: "Processor, memory, storage and screen size in one page.", a: { label: "How to choose a laptop", href: "/pages/how-to-choose" }, b: { label: "Compare laptops", href: "/compare" } },
  ],
};

export async function getGuidesIndex(): Promise<ResolvedContent> {
  const vis = await contentVisibility();
  const anyArticle = Object.values(vis.articles).some(Boolean);
  if (anyArticle && !previewAllContent()) {
    return { slug: "guides", title: GUIDES_INDEX.title, kicker: GUIDES_INDEX.kicker, intro: GUIDES_INDEX.intro, v5Status: GUIDES_INDEX.status, isLegal: false, preview: false, mode: "template", blocks: GUIDES_INDEX.blocks, html: null };
  }
  return resolve("guides", GUIDES_INDEX, undefined, false);
}

export async function getArticle(slug: string): Promise<ResolvedContent | null> {
  const tpl = V5_CONTENT.articles.find((a) => a.slug === slug);
  if (!tpl) return null;
  const rows = await visibleRows().catch(() => ({ pages: [], articles: [] }));
  return resolve(slug, tpl, rows.articles.find((r) => r.slug === slug), false);
}

/** Side navigation state (V5 `pg.side`): which pages/articles are public. */
export async function contentVisibility() {
  const rows = await visibleRows().catch(() => ({ pages: [], articles: [] }));
  const all = previewAllContent();
  return {
    pages: Object.fromEntries(
      PAGE_SLUGS.map((s) => [s, all || rows.pages.some((r) => r.slug === s && (!LEGAL_CONTENT_SLUGS.has(s) || r.legal_approved === true))]),
    ) as Record<string, boolean>,
    articles: Object.fromEntries(ARTICLE_SLUGS.map((s) => [s, all || rows.articles.some((r) => r.slug === s)])) as Record<string, boolean>,
  };
}
