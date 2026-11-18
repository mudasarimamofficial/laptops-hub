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
