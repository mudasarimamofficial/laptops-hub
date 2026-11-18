import { postInputSchema, publishProblem, type PostInput } from "@/lib/content/blog";
import { sanitizeCmsHtml } from "@/lib/security/sanitize-html";

export type PostRow = {
  slug: string;
  title: string;
  excerpt: string;
  body_html: string;
  status: "draft" | "published";
  seo_title: string | null;
  seo_description: string | null;
  cover_image_url: string | null;
  og_image_url: string | null;
  author_name: string | null;
  category: string | null;
  template_key: string | null;
};
type Built = { ok: true; row: PostRow; input: PostInput } | { ok: false; status: number; body: Record<string, unknown> };

function emptyToNull(s: string | undefined) {
  const t = (s || "").trim();
  return t ? t : null;
}

/** Validates and sanitises staff input for a blog post (row in public.articles). */
export function postRowFromInput(body: unknown): Built {
  const parsed = postInputSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, status: 400, body: { error: "validation_failed", message: "Check the highlighted fields.", fieldErrors } };
  }
  const v = parsed.data;
  const clean = v.bodyHtml.trim() ? sanitizeCmsHtml(v.bodyHtml) : "";
  const problem = publishProblem({ status: v.status, bodyHtml: clean });
  if (problem) return { ok: false, status: 400, body: { error: "validation_failed", message: problem, fieldErrors: { bodyHtml: problem } } };
  return {
    ok: true,
    input: v,
    row: {
      slug: v.slug,
      title: v.title,
      excerpt: v.excerpt,
      body_html: clean,
      status: v.status,
      seo_title: emptyToNull(v.seoTitle),
      seo_description: emptyToNull(v.seoDescription),
      cover_image_url: emptyToNull(v.coverImageUrl),
      og_image_url: emptyToNull(v.ogImageUrl),
      author_name: emptyToNull(v.authorName),
      category: emptyToNull(v.category),
      template_key: emptyToNull(v.templateKey),
    },
  };
}
