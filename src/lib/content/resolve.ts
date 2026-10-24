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
};

export type ContentRow = { slug: string; title: string; body_html: string | null; status: string; legal_approved?: boolean | null };

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

