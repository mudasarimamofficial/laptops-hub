import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { LEGAL_CONTENT_SLUGS } from "@/lib/security/sanitize-html";
import { V5_CONTENT } from "@/lib/content/v5-content";
import type { V5Page } from "@/lib/content/types";
import {
  articleSeoFromRow,
  isContentPublic,
  previewAllContent,
  resolveContent as resolve,
  type ContentRow as Row,
  type ResolvedContent,
} from "@/lib/content/resolve";
import { cleanTags, isArticlePubliclyVisible, matchesGuideFilter, postKicker, readMinutes, hasGuideFilter, type GuideFilter } from "@/lib/content/blog";
import { sanitizeCmsHtml } from "@/lib/security/sanitize-html";

export { previewAllContent, type ResolvedContent };

/**
 * Publication model for /pages/* and /guides/* (V5 `isPage` routes):
 *
 * - The CMS row is the source of truth. It is read with the anon key, so RLS decides visibility:
 *   `status = 'published'` and, for policy slugs, `legal_approved = true` (migration 20261021160000).
 * - Visible row with a body  → sanitized CMS HTML inside the V5 page shell.
 * - Visible row, empty body   → the V5 template content, only for templates with no pending ("being finalised")
 *   sections; publishing it requires explicit template approval in admin. Otherwise the page stays gated.
 * - Not visible               → not public at all: the route answers 404 and every link to it (header, footer, mega
 *   menu, side navigation, product policy cards, sitemap) is hidden. Customers never see unfinished copy.
 * - Routes for /pages and /guides read publication FRESH on every request (no data or page cache), so a withdrawal or
 *   legal-approval revocation is enforced on the next request whatever the CDN/ISR state. Chrome (header/footer) uses
 *   the 60s `content`-tagged cache, expired on every CMS change; a briefly stale link can only lead to a 404.
 * - V5_CONTENT_PREVIEW=1 renders template content for QA/parity, and is ignored on Vercel Production.
 */
export const PAGE_SLUGS = Object.keys(V5_CONTENT.pages);
export const ARTICLE_SLUGS = V5_CONTENT.articles.map((a) => a.slug);
const TEMPLATE_ARTICLES = new Set(ARTICLE_SLUGS);

/** Blog posts written in /admin/blog with their own slug (no V5 template): public when published with a body. */
function isCmsPostPublic(r: Row): boolean {
  return r.status === "published" && !!(r.body_html || "").replace(/<[^>]*>/g, "").trim();
}

type Rows = { pages: Row[]; articles: Row[] };

/** Publicly visible CMS rows, read with the anon key (RLS decides). A failed read counts as "nothing public". */
async function readVisibleRows(): Promise<Rows> {
  const sb = createPublicClient();
  const [p0, a] = await Promise.all([
    sb.from("content_pages").select("slug, title, body_html, status, legal_approved, seo_title, seo_description").eq("status", "published"),
    sb
      .from("articles")
      .select(
        "slug, title, excerpt, body_html, status, published_at, updated_at, scheduled_for, seo_title, seo_description, og_image_url, cover_image_url, author_name, category, tags, template_key",
      )
      .eq("status", "published"),
  ]);
  // Before the G19 database update the search columns do not exist: read without them rather than hide every page.
  const p = p0.error
    ? await sb.from("content_pages").select("slug, title, body_html, status, legal_approved").eq("status", "published")
    : p0;
  if (p.error || a.error) throw new Error("content read failed");
  const articles = ((a.data as (Row & { status?: string; scheduled_for?: string | null })[] | null) || []).filter((row) =>
    isArticlePubliclyVisible({ status: row.status || "published", scheduled_for: row.scheduled_for }),
  );
  return { pages: (p.data as Row[] | null) || [], articles };
}

/** Cached 60s under the `content` tag — for site chrome only (expired by every CMS change). */
const cachedVisibleRows = unstable_cache(readVisibleRows, ["v5-content-visible"], { revalidate: 60, tags: ["content"] });

const rowsFor = (fresh: boolean): Promise<Rows> =>
  (fresh ? readVisibleRows() : cachedVisibleRows()).catch(() => ({ pages: [], articles: [] }));

/** `fresh` = bypass every cache (content routes, checkout policy gate). */
export async function getContentPage(slug: string, fresh = false): Promise<ResolvedContent | null> {
  const tpl = V5_CONTENT.pages[slug];
  const rows = await rowsFor(fresh);
  const row = rows.pages.find((r) => r.slug === slug);
  const seo = { title: (row?.seo_title || "").trim(), description: (row?.seo_description || "").trim() };
  if (!tpl) {
    // G19: a page made in Admin → Content (no V5 template). Public only when published with a body; never a policy.
    if (!row || LEGAL_CONTENT_SLUGS.has(slug) || !isCmsPostPublic(row)) return null;
    const html = sanitizeCmsHtml(row.body_html || "");
    return { slug, title: row.title, kicker: "", intro: "", mode: "cms", v5Status: "ready", blocks: [], html, isLegal: false, preview: false, seo };
  }
  const r = resolve(slug, tpl, row, LEGAL_CONTENT_SLUGS.has(slug));
  return r && r.mode === "cms" ? { ...r, seo } : r && r.mode === "template" && !r.preview ? { ...r, seo } : r;
}

/** G19: where an old page address now lives (Admin → Content address change), or null. */
export async function getContentRedirect(slug: string): Promise<string | null> {
  const { data } = await createPublicClient().from("content_slug_redirects").select("to_slug").eq("from_slug", slug).maybeSingle();
  return (data?.to_slug as string | undefined) || null;
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

export async function getGuidesIndex(fresh = false): Promise<ResolvedContent> {
  const vis = await contentVisibility(fresh);
  const anyArticle = Object.values(vis.articles).some(Boolean);
  if (anyArticle && !previewAllContent()) {
    return { slug: "guides", title: GUIDES_INDEX.title, kicker: GUIDES_INDEX.kicker, intro: GUIDES_INDEX.intro, v5Status: GUIDES_INDEX.status, isLegal: false, preview: false, mode: "template", blocks: GUIDES_INDEX.blocks, html: null };
  }
  return resolve("guides", GUIDES_INDEX, undefined, false);
}

export async function getArticle(slug: string, fresh = false): Promise<ResolvedContent | null> {
  const tpl = V5_CONTENT.articles.find((a) => a.slug === slug);
  const rows = await rowsFor(fresh);
  const row = rows.articles.find((r) => r.slug === slug);
  if (tpl) {
    const r = resolve(slug, tpl, row, false);
    return r ? { ...r, article: articleSeoFromRow(row) } : r;
  }
  // A post with its own slug: public only when published with a body (RLS already hides unpublished rows).
  if (!row || !isCmsPostPublic(row)) return null;
  const html = sanitizeCmsHtml(row.body_html || "");
  return {
    slug,
    title: row.title,
    kicker: postKicker(row),
    intro: (row.excerpt || "").trim(),
    read: `${readMinutes(html)} min`,
    mode: "cms",
    v5Status: "ready",
    blocks: [],
    html,
    isLegal: false,
    preview: false,
    article: articleSeoFromRow(row),
  };
}

export type PostCard = { slug: string; title: string; kicker: string; read: string; intro: string; category: string; tags: string[] };

/** Public guides for cards and side navigation: new posts (newest first), then the published V5 guides. */
export async function publicPostCards(fresh = false, filter?: GuideFilter | null): Promise<PostCard[]> {
  const rows = await rowsFor(fresh);
  const all = previewAllContent();
  const posts = rows.articles
    .filter((r) => !TEMPLATE_ARTICLES.has(r.slug) && isCmsPostPublic(r))
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")))
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      kicker: postKicker(r),
      read: `${readMinutes(r.body_html || "")} min`,
      intro: (r.excerpt || "").trim(),
      category: (r.category || "").trim(),
      tags: cleanTags(r.tags),
    }))
    .filter((p) => matchesGuideFilter(p, filter));
  const templates = V5_CONTENT.articles
    .filter((a) => all || isContentPublic(a, rows.articles.find((r) => r.slug === a.slug), false))
    .map((a) => ({ slug: a.slug, title: a.title, kicker: a.kicker, read: a.read || "", intro: a.intro, category: "", tags: [] as string[] }));
  // V5 template guides carry no category or tags, so a filtered list shows CMS posts only.
  return hasGuideFilter(filter) ? posts : [...posts, ...templates];
}

export type ContentVisibility = { pages: Record<string, boolean>; articles: Record<string, boolean> };

/** Which pages/articles are public (navigation, sitemap, policy cards, checkout gate). */
export async function contentVisibility(fresh = false): Promise<ContentVisibility> {
  const rows = await rowsFor(fresh);
  const all = previewAllContent();
  return {
    pages: Object.fromEntries([
      ...PAGE_SLUGS.map((s) => [s, all || isContentPublic(V5_CONTENT.pages[s], rows.pages.find((r) => r.slug === s), LEGAL_CONTENT_SLUGS.has(s))]),
      // G19: published pages made in admin (no template); never policies.
      ...rows.pages
        .filter((r) => !V5_CONTENT.pages[r.slug] && !LEGAL_CONTENT_SLUGS.has(r.slug) && isCmsPostPublic(r))
        .map((r) => [r.slug, true]),
    ]) as Record<string, boolean>,
    articles: Object.fromEntries([
      ...V5_CONTENT.articles.map((a) => [a.slug, all || isContentPublic(a, rows.articles.find((r) => r.slug === a.slug), false)]),
      ...rows.articles.filter((r) => !TEMPLATE_ARTICLES.has(r.slug) && isCmsPostPublic(r)).map((r) => [r.slug, true]),
    ]) as Record<string, boolean>,
  };
}
