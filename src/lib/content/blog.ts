import { z } from "zod";

/**
 * Blog posts ("Guides") are rows in `public.articles` (anon may read only `status = 'published'`
 * and only after `scheduled_for` when set). Staff write them in /admin/blog.
 */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || /^https:\/\//i.test(v), "Use an https:// image address.")
  .optional()
  .default("");

export const postInputSchema = z.object({
  slug: z.string().trim().min(3, "Use at least 3 characters.").max(80).regex(SLUG_RE, "Use lowercase letters, numbers and hyphens."),
  title: z.string().trim().min(3, "Enter a title.").max(160),
  excerpt: z.string().trim().max(300).optional().default(""),
  bodyHtml: z.string().max(100_000).optional().default(""),
  status: z.enum(["draft", "published"]),
  seoTitle: z.string().trim().max(70).optional().default(""),
  seoDescription: z.string().trim().max(160).optional().default(""),
  coverImageUrl: httpsUrl,
  ogImageUrl: httpsUrl,
  authorName: z.string().trim().max(80).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  templateKey: z.string().trim().max(40).optional().default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  /** ISO datetime or empty. Future dates keep the post off the public site until due (with status published). */
  scheduledFor: z
    .string()
    .trim()
    .max(40)
    .optional()
    .default("")
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid schedule date."),
});

export type PostInput = z.infer<typeof postInputSchema>;

/** Rough reading time from sanitised HTML (≈200 words per minute, minimum 1). */
export function readMinutes(html: string): number {
  const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * A published post must have its own written body. An empty body on a V5 guide slug would otherwise publish
 * unreviewed template copy, so the blog editor never publishes template text implicitly.
 */
export function publishProblem(p: Pick<PostInput, "status" | "bodyHtml">): string | null {
  if (p.status !== "published") return null;
  const text = p.bodyHtml.replace(/<[^>]*>/g, "").trim();
  return text ? null : "Write the post before publishing it.";
}

/** Merchant-facing status label including schedule. */
export function articleVisibilityLabel(row: {
  status: string;
  scheduled_for?: string | null;
}): "Draft" | "Published" | "Scheduled" {
  if (row.status === "published" && row.scheduled_for && Date.parse(row.scheduled_for) > Date.now()) {
    return "Scheduled";
  }
  if (row.status === "published") return "Published";
  return "Draft";
}

/** Public listing filter (defense in depth alongside RLS). */
export function isArticlePubliclyVisible(row: {
  status: string;
  scheduled_for?: string | null;
}): boolean {
  if (row.status !== "published") return false;
  if (!row.scheduled_for) return true;
  return Date.parse(row.scheduled_for) <= Date.now();
}

/**
 * G18 — public blog taxonomy. Admin › Blog stores `category`, `tags` and `template_key` (the starter used); the public
 * site uses them for the card/article label, tag and category links, a filtered /guides index and Article markup.
 */
export const TEMPLATE_KICKERS: Record<string, string> = {
  standard: "Guide",
  "buying-guide": "Buying guide",
  "product-review": "Review",
  comparison: "Comparison",
  howto: "How-to",
  news: "News",
};

const oneLine = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Public label: the category, else the template's label, else "Guide". */
export function postKicker(r: { category?: string | null; template_key?: string | null }) {
  return oneLine(r.category, 80) || TEMPLATE_KICKERS[r.template_key || ""] || "Guide";
}

/** Trimmed, de-duplicated (case-insensitive), at most 20. */
export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const s = oneLine(t, 40);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, 20);
}

export type GuideFilter = { category: string; tag: string };

/** `?category=` / `?tag=` from the URL (first value, plain text). */
export function parseGuideFilter(sp: Record<string, string | string[] | undefined> | undefined): GuideFilter {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { category: oneLine(first(sp?.category), 80), tag: oneLine(first(sp?.tag), 40) };
}

export const hasGuideFilter = (f: GuideFilter | null | undefined) => !!f && !!(f.category || f.tag);

/** Case-insensitive match; an empty filter matches everything. */
export function matchesGuideFilter(post: { category?: string | null; tags?: string[] }, f: GuideFilter | null | undefined) {
  if (!hasGuideFilter(f)) return true;
  if (f!.category && oneLine(post.category, 80).toLowerCase() !== f!.category.toLowerCase()) return false;
  if (f!.tag && !(post.tags || []).some((t) => t.toLowerCase() === f!.tag.toLowerCase())) return false;
  return true;
}

export const guideFilterHref = (f: Partial<GuideFilter>) => {
  const q = new URLSearchParams();
  if (f.category) q.set("category", f.category);
  if (f.tag) q.set("tag", f.tag);
  const s = q.toString();
  return s ? `/guides?${s}` : "/guides";
};
