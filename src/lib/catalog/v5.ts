import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { listAllPublicProducts } from "@/lib/catalog/queries";
import { toV5, type V5Product } from "@/lib/catalog/v5-model";

export * from "@/lib/catalog/v5-model";

/** Import order by handle (products.created_at is readable by anon for active rows). */
async function catalogOrder(): Promise<Map<string, number>> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("handle, created_at")
    .eq("status", "active")
    .order("created_at")
    .order("handle")
    .range(0, 999);
  const map = new Map<string, number>();
  if (error || !data) return map;
  data.forEach((r: { handle: string }, i) => map.set(r.handle, i));
  return map;
}

/** Public catalog in V5 shape, cached for 60s (tag `catalog`). */
export const getV5Catalog = unstable_cache(async (): Promise<V5Product[]> => {
  const [products, order] = await Promise.all([listAllPublicProducts(createPublicClient()), catalogOrder()]);
  const fallback = order.size;
  return products
    .map((p) => ({ p, i: order.get(p.handle) ?? fallback }))
    .sort((a, b) => a.i - b.i || a.p.handle.localeCompare(b.p.handle))
    .map(({ p }, i) => toV5(p, i));
}, ["v5-catalog"], { revalidate: 60, tags: ["catalog"] });

