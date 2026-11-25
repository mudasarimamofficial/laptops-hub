import { unstable_cache } from "next/cache";
import { listAllPublicProducts } from "@/lib/catalog/queries";
import { createPublicClient } from "@/lib/supabase/server";
import { isAutomatedRule, productMatchesRule, type CollectionRule } from "./rule-eval";

export type StorefrontCollection = {
  slug: string;
  title: string;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Public product handles in display order: manual pins by position, or every product matching the automated rule. */
  handles: string[];
};

/**
 * A merchant-made collection (Admin → Collections) as the storefront shows it: published, not deleted, public
 * products only. The built-in V5 collections (`V5_COLS`) keep their own definitions; this serves every other slug.
 * Cached like the catalog; the admin collection routes revalidate the "collections" tag on every change.
 */
export const getStorefrontCollection = unstable_cache(
  async (slug: string): Promise<StorefrontCollection | null> => {
    const db = createPublicClient();
    const { data: row } = await db
      .from("collections")
      .select("slug, title, description, seo_title, seo_description, rule, collection_type, collection_products(product_id, position)")
      .eq("slug", slug)
      .eq("published", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) return null;

    const all = await listAllPublicProducts(db);
    const pins = ((row.collection_products || []) as { product_id: string; position: number }[]).slice().sort((a, b) => a.position - b.position);
    const rule = row.rule as CollectionRule | null;
    const automated = row.collection_type === "automated" || (isAutomatedRule(rule) && pins.length === 0);

    let handles: string[];
    if (automated && isAutomatedRule(rule)) {
      handles = all.filter((p) => productMatchesRule(p, rule)).map((p) => p.handle);
    } else {
      const byId = new Map(all.map((p) => [p.id, p.handle]));
      handles = pins.map((p) => byId.get(p.product_id)).filter((h): h is string => Boolean(h));
    }
    return {
      slug: row.slug,
      title: row.title,
      description: row.description || "",
      seoTitle: row.seo_title || null,
      seoDescription: row.seo_description || null,
      handles,
    };
  },
  ["storefront-collection"],
  { revalidate: 60, tags: ["catalog", "collections"] },
);

/**
 * Search fields an admin saved on a collection row, without loading its products. Lets the built-in V5 collections
 * (which keep their code definitions) use a search title/description edited in Admin → Collections.
 */
export const getCollectionSeo = unstable_cache(
  async (slug: string): Promise<{ seoTitle: string | null; seoDescription: string | null; description: string | null } | null> => {
    const { data } = await createPublicClient()
      .from("collections")
      .select("seo_title, seo_description, description")
      .eq("slug", slug)
      .eq("published", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return null;
    const t = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : null);
    return { seoTitle: t(data.seo_title), seoDescription: t(data.seo_description), description: t(data.description) };
  },
  ["collection-seo"],
  { revalidate: 60, tags: ["collections"] },
);
