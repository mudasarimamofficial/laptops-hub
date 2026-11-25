import { sanitizeCmsHtml } from "@/lib/security/sanitize-html";
import type { V5Block, V5Page } from "@/lib/content/types";

/** Pure publication rules for content pages (see src/lib/content/pages.ts). */
export type ContentMode = "cms" | "template" | "gated";

export type ResolvedContent = {
  slug: string;
  title: string;
  kicker: string;
  intro: string;
  read?: string;
  mode: ContentMode;
  /** V5 template status, shown as the header tag only in template mode (as V5 does). */
  v5Status: V5Page["status"];
  blocks: V5Block[];
  html: string | null;
  isLegal: boolean;
  /** Template shown only because V5_CONTENT_PREVIEW is on (not published): V5 header tags are reproduced. */
  preview: boolean;
  /** Guides only: search/social fields and dates from Admin → Blog (empty strings = not set). */
  article?: ArticleSeo;
};

export type ArticleSeo = {
  seoTitle: string;
  seoDescription: string;
  /** https share image: og_image_url, else the cover image; "" when neither is a safe https URL. */
  image: string;
  author: string;
  publishedAt: string | null;
  modifiedAt: string | null;
};

export type ContentRow = {
  slug: string;
  title: string;
  body_html: string | null;
  status: string;
  legal_approved?: boolean | null;
  excerpt?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
  cover_image_url?: string | null;
  author_name?: string | null;
};

const httpsUrl = (u: string | null | undefined) => {
  const s = (u || "").trim();
  try {
    return s && new URL(s).protocol === "https:" ? s : "";
  } catch {
    return "";
  }
};
const plain = (s: string | null | undefined, max: number) =>
  (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Search fields of a published article row (plain text, https images only). */
export function articleSeoFromRow(row: ContentRow | undefined): ArticleSeo | undefined {
  if (!row) return undefined;
  return {
    seoTitle: plain(row.seo_title, 120),
    seoDescription: plain(row.seo_description, 320),
    image: httpsUrl(row.og_image_url) || httpsUrl(row.cover_image_url),
    author: plain(row.author_name, 80),
    publishedAt: row.published_at || null,
    modifiedAt: row.updated_at || null,
  };
}

export function previewAllContent() {
  return process.env.V5_CONTENT_PREVIEW === "1" && process.env.VERCEL_ENV !== "production";
}

/** Template sections still waiting for owner facts: "being finalised" blocks or unanswered FAQ items. */
export function templateHasPending(tpl: V5Page) {
  return tpl.blocks.some((b) => b.t === "pending" || (b.t === "faq" && b.items.some((i) => i.pending)));
}

/**
 * Public only when published (and legally approved for policy pages) AND it has approved copy: either its own CMS
 * body, or an empty body on a template with no pending sections (publishing such a template requires the explicit
 * template approval in /api/admin/content). An empty body never publishes unresolved template sections.
 */
export function isContentPublic(tpl: V5Page, row: ContentRow | undefined, isLegal: boolean) {
  if (!row || row.status !== "published" || (isLegal && row.legal_approved !== true)) return false;
  return !!(row.body_html || "").trim() || !templateHasPending(tpl);
}

/**
 * Public page intros where the V5 template intro describes unfinished work or another page's purpose. The V5 template
 * text is kept for (non-production) preview only.
 */
export const PUBLIC_INTROS: Record<string, string> = {
  about: "A laptop retailer in Bahawalpur, Pakistan, with prices in PKR and the recorded specifications of each listing.",
  faq: "Answers to common questions about ordering, payment, delivery and our laptops.",
  "order-inquiries": "How to check on an existing order or ask our team about it.",
};

export function resolveContent(slug: string, tpl: V5Page, row: ContentRow | undefined, isLegal: boolean): ResolvedContent {
  const base = { slug, kicker: tpl.kicker, intro: PUBLIC_INTROS[slug] ?? tpl.intro, read: tpl.read, v5Status: tpl.status, isLegal, preview: false };
  // Defence in depth: RLS already hides unpublished rows; enforce the same rules here so an RLS regression cannot publish.
  if (row && isContentPublic(tpl, row, isLegal)) {
    const body = (row.body_html || "").trim();
    // CMS copy replaces the template text; the template's working form (contact page) stays below it.
    if (body) return { ...base, title: row.title || tpl.title, mode: "cms", blocks: tpl.blocks.filter((b) => b.t === "form"), html: sanitizeCmsHtml(body) };
    return { ...base, title: row.title || tpl.title, mode: "template", blocks: tpl.blocks, html: null };
  }
  if (previewAllContent()) return { ...base, intro: tpl.intro, title: tpl.title, mode: "template", blocks: tpl.blocks, html: null, preview: true };
  // Gated: only the template's form (functionality, not a claim) and its customer-facing "being finalised"
  // sections; no unapproved copy. Pages without such a section get one named after the page.
  const blocks: V5Block[] = tpl.blocks.filter((b) => b.t === "form" || b.t === "pending");
  if (!blocks.some((b) => b.t === "pending")) blocks.push({ t: "pending", v: tpl.title });
  return { ...base, title: tpl.title, mode: "gated", blocks, html: null };
}

