import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { TESTIMONIAL_SOURCES, type PublicTestimonial, type TestimonialSource } from "@/lib/content/testimonials";

/**
 * Published homepage testimonials, read with the anon key so RLS and column grants decide what is visible (migration
 * 20261118100000). Cached 60 s under the `testimonials` tag, which every admin change expires. Any failure means
 * "none" — the section is then not rendered (no placeholder or invented entries).
 */
export const getPublishedTestimonials = unstable_cache(
  async (): Promise<PublicTestimonial[]> => {
    try {
      const { data, error } = await createPublicClient()
        .from("store_testimonials")
        .select("id, author_name, rating, body, review_date, source, source_url, avatar_url")
        .eq("status", "published")
        .eq("show_on_homepage", true)
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false })
        .limit(60);
      if (error || !data) return [];
      return data
        .filter((r) => (TESTIMONIAL_SOURCES as readonly string[]).includes(r.source))
        .map((r) => ({
          id: r.id,
          authorName: r.author_name,
          rating: typeof r.rating === "number" ? r.rating : null,
          body: r.body,
          reviewDate: r.review_date ?? null,
          source: r.source as TestimonialSource,
          sourceUrl: r.source_url ?? null,
          avatarUrl: r.avatar_url ?? null,
        }));
    } catch {
      return [];
    }
  },
  ["published-testimonials"],
  { revalidate: 60, tags: ["testimonials"] },
);
