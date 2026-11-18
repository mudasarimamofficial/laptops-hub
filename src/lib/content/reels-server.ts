import { unstable_cache } from "next/cache";
import { createPublicClient, createServiceClient } from "@/lib/supabase/server";
import { getV5Catalog, fmtPkr } from "@/lib/catalog/v5";
import { isRenderableReel, type PublicReel, type ReelShopProduct } from "@/lib/content/reels";

function shopProductFromHandle(
  handle: string,
  byHandle: Map<string, Awaited<ReturnType<typeof getV5Catalog>>[number]>,
): ReelShopProduct | null {
  const p = byHandle.get(handle);
  if (!p || !p.variantId) return null;
  return {
    handle: p.h,
    title: p.t,
    model: p.model,
    config: p.config,
    priceText: p.hasOptions ? `From ${fmtPkr(p.fromPricePaisa)}` : fmtPkr(p.pricePaisa),
    pricePaisa: p.pricePaisa,
    compareAtText: null,
    imageUrl: p.imgs[0]?.u ?? null,
    available: Boolean(p.avail && p.pricePaisa > 0),
    variantId: p.variantId,
    maxPerOrder: p.maxPerOrder ?? 5,
    sku: p.sku ?? null,
  };
}

/**
 * Published reels with confirmed rights.
 * Product associations come from `reel_products` (with legacy `product_id` fallback).
 * Cached 60 s under the `reels` tag.
 */
export const getPublishedReels = unstable_cache(
  async (): Promise<PublicReel[]> => {
    try {
      const sb = createPublicClient();
      const { data, error } = await sb
        .from("reels")
        .select(
          "id, title, caption, video_url, hls_url, poster_url, avatar_url, link_path, creator_name, tag, product_id, products(handle)",
        )
        .eq("status", "published")
        .in("rights_status", ["owned", "licensed"])
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error || !data?.length) return [];

      const ids = data.map((r) => r.id);
      const linksByReel = new Map<string, string[]>();

      // Prefer service client for join table if public grants are not yet live; fall back to empty.
      try {
        const svc = createServiceClient();
        const { data: links } = await svc
          .from("reel_products")
          .select("reel_id, sort_order, products(handle)")
          .in("reel_id", ids)
          .order("sort_order", { ascending: true });
        for (const row of links || []) {
          const handle = (row.products as { handle?: string } | null)?.handle;
          if (!handle) continue;
          const list = linksByReel.get(row.reel_id) || [];
          list.push(handle);
          linksByReel.set(row.reel_id, list);
        }
      } catch {
        /* table may not exist until migration is applied */
      }

      const catalog = await getV5Catalog();
      const byHandle = new Map(catalog.map((p) => [p.h, p]));

      return data
        .map((r) => {
          const legacy = (r.products as { handle?: string } | null)?.handle ?? null;
          let handles = linksByReel.get(r.id) || [];
          if (!handles.length && legacy) handles = [legacy];
          const products = handles
            .map((h) => shopProductFromHandle(h, byHandle))
            .filter((x): x is ReelShopProduct => Boolean(x));
          return {
            id: r.id,
            title: r.title,
            caption: r.caption,
            videoUrl: r.video_url,
            hlsUrl: r.hls_url ?? null,
            posterUrl: r.poster_url,
            avatarUrl: r.avatar_url ?? null,
            productHandle: products[0]?.handle ?? legacy,
            productHandles: handles,
            products,
            linkPath: r.link_path ?? null,
            creatorName: r.creator_name ?? "",
            tag: r.tag ?? "",
          } satisfies PublicReel;
        })
        .filter(isRenderableReel);
    } catch {
      return [];
    }
  },
  ["published-reels-v2"],
  { revalidate: 60, tags: ["reels"] },
);
