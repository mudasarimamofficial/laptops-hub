import { createClient } from "@/lib/supabase/server";
import { listAllPublicProducts } from "@/lib/catalog/queries";
import type { PublicProduct } from "@/types/catalog";
import { COLLECTION_DEFS, getCollectionDef } from "./definitions";

export type ResolvedCollection = {
  slug: string;
  title: string;
  description: string;
  products: PublicProduct[];
  total: number;
  source: "db+matcher" | "matcher" | "db-pins";
};

export async function resolveCollection(
  slug: string,
  opts?: { limit?: number; offset?: number },
): Promise<ResolvedCollection | null> {
  const def = getCollectionDef(slug);
  const supabase = await createClient();
  const limit = opts?.limit ?? 48;
  const offset = opts?.offset ?? 0;

  const { data: row } = await supabase
    .from("collections")
    .select("slug, title, description, published, collection_products(product_id, position)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!def && !row) return null;

  const pins = (row?.collection_products || []) as { product_id: string; position: number }[];
  const all = await listAllPublicProducts();

  if (pins.length > 0) {
    const byId = new Map(all.map((p) => [p.id, p]));
    const pinned = pins
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => byId.get(p.product_id))
      .filter(Boolean) as PublicProduct[];
    return {
      slug,
      title: row?.title || def?.title || slug,
      description: row?.description || def?.description || "",
      products: pinned.slice(offset, offset + limit),
      total: pinned.length,
      source: "db-pins",
    };
  }

  const matcher = def || COLLECTION_DEFS.find((c) => c.slug === slug);
  if (!matcher) {
    return {
      slug,
      title: row!.title,
      description: row!.description || "",
      products: [],
      total: 0,
      source: "db+matcher",
    };
  }

  const matched = all.filter(matcher.match);
  return {
    slug,
    title: row?.title || matcher.title,
    description: row?.description || matcher.description,
    products: matched.slice(offset, offset + limit),
    total: matched.length,
    source: row ? "db+matcher" : "matcher",
  };
}
