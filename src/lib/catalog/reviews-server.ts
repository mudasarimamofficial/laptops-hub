import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { reviewSummary } from "@/lib/validation/review";

export type PublicReview = { id: string; author: string; rating: number; title: string; body: string; date: string };
export type ProductReviews = { reviews: PublicReview[]; count: number; average: number | null };

const EMPTY: ProductReviews = { reviews: [], count: 0, average: null };

/**
 * Approved reviews for one product, read with the anon key (RLS: approved only; private columns not granted).
 * Cached 60 s under the `reviews` tag (expired by every moderation). Failure ⇒ no reviews shown (never invented).
 */
export const getApprovedReviews = unstable_cache(
  async (handle: string): Promise<ProductReviews> => {
    try {
      const { data, error } = await createPublicClient()
        .from("product_reviews")
        .select("id, author_name, rating, title, body, created_at, products!inner(handle)")
        .eq("products.handle", handle)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error || !data) return EMPTY;
      const reviews = data.map((r) => ({ id: r.id, author: r.author_name, rating: r.rating, title: r.title, body: r.body, date: r.created_at }));
      const s = reviewSummary(reviews.map((r) => r.rating));
      return { reviews, count: s.count, average: s.average };
    } catch {
      return EMPTY;
    }
  },
  ["approved-reviews"],
  { revalidate: 60, tags: ["reviews"] },
);
