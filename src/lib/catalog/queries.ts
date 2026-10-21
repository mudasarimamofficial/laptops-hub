import { createClient } from "@/lib/supabase/server";
import type { PublicProduct } from "@/types/catalog";

type ProductRow = {
  id: string;
  handle: string;
  title: string;
  description_safe: string;
  manufacturer: string | null;
  product_type: string | null;
  category: string | null;
  featured: boolean;
  tags: string[] | null;
  specs: Record<string, unknown> | null;
  product_variants: {
    id: string;
    sku: string | null;
    price_paisa: number;
    compare_at_paisa: number | null;
    max_per_order: number;
    purchasable: boolean;
  }[];
  product_media: { url: string; alt: string; position: number }[];
};

function mapProduct(row: ProductRow): PublicProduct | null {
  const variant = row.product_variants?.find((v) => v.purchasable && v.price_paisa > 0);
  if (!variant) return null;
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    descriptionSafe: row.description_safe || "",
    manufacturer: row.manufacturer,
    productType: row.product_type,
    category: row.category,
    featured: row.featured,
    tags: row.tags || [],
    specs: row.specs || {},
    variantId: variant.id,
    sku: variant.sku,
    pricePaisa: variant.price_paisa,
    compareAtPaisa: variant.compare_at_paisa,
    maxPerOrder: variant.max_per_order,
    images: (row.product_media || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ url: m.url, alt: m.alt || row.title, position: m.position })),
  };
}

const productSelect = `
  id, handle, title, description_safe, manufacturer, product_type, category,
  featured, tags, specs,
  product_variants ( id, sku, price_paisa, compare_at_paisa, max_per_order, purchasable ),
  product_media ( url, alt, position )
`;

export async function listPublicProducts(limit = 48, offset = 0): Promise<PublicProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("status", "active")
    .order("title")
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data as ProductRow[] | null)?.map(mapProduct).filter(Boolean) as PublicProduct[];
}

export async function getPublicProductByHandle(handle: string): Promise<PublicProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("handle", handle)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProduct(data as ProductRow);
}

export async function countPublicProducts(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (error) throw error;
  return count ?? 0;
}

export async function searchPublicProducts(q: string, limit = 24): Promise<PublicProduct[]> {
  const term = q.trim();
  if (!term) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("status", "active")
    .or(`title.ilike.%${term}%,handle.ilike.%${term}%,manufacturer.ilike.%${term}%`)
    .limit(limit);
  if (error) throw error;
  return (data as ProductRow[] | null)?.map(mapProduct).filter(Boolean) as PublicProduct[];
}

/** Removed: privileged counts must only run after requireStaff() inside /admin pages. */
