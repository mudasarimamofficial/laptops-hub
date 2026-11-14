import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { isRenderableReel, type PublicReel } from "@/lib/content/reels";

/**
 * Published reels with confirmed rights, read with the anon key so RLS decides visibility (migration 20261115100000).
 * Cached 60 s under the `reels` tag (expired by every admin change). Any failure means "no reels" — the homepage row
 * is then simply not rendered.
 */
export const getPublishedReels = unstable_cache(
  async (): Promise<PublicReel[]> => {
    try {
      const { data, error } = await createPublicClient()
        .from("reels")
        .select("id, title, caption, video_url, poster_url, products(handle)")
        .eq("status", "published")
        .in("rights_status", ["owned", "licensed"])
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error || !data) return [];
      return data
        .map((r) => ({
          id: r.id,
          title: r.title,
          caption: r.caption,
          videoUrl: r.video_url,
          posterUrl: r.poster_url,
          productHandle: (r.products as { handle?: string } | null)?.handle ?? null,
        }))
        .filter(isRenderableReel);
    } catch {
      return [];
    }
  },
  ["published-reels"],
  { revalidate: 60, tags: ["reels"] },
);
