import { z } from "zod";

/**
 * Blog posts ("Guides") are rows in `public.articles` (anon may read only `status = 'published'`). Staff write them in
 * /admin/blog. A post either fills one of the V5 guide templates (same slug) or is a new post with its own slug; the
 * body is sanitised on save and again on render.
 */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const postInputSchema = z.object({
  slug: z.string().trim().min(3, "Use at least 3 characters.").max(80).regex(SLUG_RE, "Use lowercase letters, numbers and hyphens."),
  title: z.string().trim().min(3, "Enter a title.").max(160),
  excerpt: z.string().trim().max(300).optional().default(""),
  bodyHtml: z.string().max(100_000).optional().default(""),
  status: z.enum(["draft", "published"]),
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
