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

type ListingRow = {
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
  variant_id: string;
  sku: string | null;
  price_paisa: number;
  compare_at_paisa: number | null;
  max_per_order: number;
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

function mapListing(row: ListingRow, media: { url: string; alt: string; position: number }[] = []): PublicProduct {
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
    variantId: row.variant_id,
    sku: row.sku,
    pricePaisa: row.price_paisa,
    compareAtPaisa: row.compare_at_paisa,
    maxPerOrder: row.max_per_order,
    images: media
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

const PAGE = 100;

/** Paginate through the entire active catalog (no hard 226 cap). */
export async function listAllPublicProducts(): Promise<PublicProduct[]> {
  const supabase = await createClient();
  const out: PublicProduct[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select(productSelect)
      .eq("status", "active")
      .order("title")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = (data as ProductRow[] | null)?.map(mapProduct).filter(Boolean) as PublicProduct[];
    out.push(...(batch || []));
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

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

export async function searchPublicProducts(q: string, limit = 48, offset = 0): Promise<PublicProduct[]> {
  const term = q.trim();
  if (!term) return [];
  const result = await filterPublicProducts({ q: term, limit, offset, sort: "title" });
  return result.products;
}

export type CatalogFilter = {
  q?: string;
  brand?: string;
  category?: string;
  minPaisa?: number;
  maxPaisa?: number;
  sort?: "price_asc" | "price_desc" | "title" | "featured";
  limit?: number;
  offset?: number;
};

export type CatalogPage = {
  products: PublicProduct[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * Database-backed filter/sort/paginate over the full public catalog listing view.
 * Sorting applies to the complete match set before pagination.
 */
export async function filterPublicProducts(filter: CatalogFilter): Promise<CatalogPage> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(filter.limit ?? 48, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);

  let query = supabase.from("public_catalog_listing").select("*", { count: "exact" });

  if (filter.q?.trim()) {
    const term = filter.q.trim().replace(/[%(),]/g, "");
    query = query.or(`title.ilike.%${term}%,handle.ilike.%${term}%,manufacturer.ilike.%${term}%`);
  }
  if (filter.brand?.trim()) {
    const b = filter.brand.trim().replace(/[%(),]/g, "");
    // Exclude merchant vendor confusion: require manufacturer match (not "Laptops HUB")
    query = query.ilike("manufacturer", `%${b}%`).not("manufacturer", "ilike", "%laptops hub%");
  }
  if (filter.category?.trim()) {
    const c = filter.category.trim().replace(/[%(),]/g, "");
    query = query.or(`category.ilike.%${c}%,product_type.ilike.%${c}%`);
  }
  if (filter.minPaisa != null) query = query.gte("price_paisa", filter.minPaisa);
  if (filter.maxPaisa != null) query = query.lte("price_paisa", filter.maxPaisa);

  switch (filter.sort) {
    case "price_asc":
      query = query.order("price_paisa", { ascending: true }).order("title");
      break;
    case "price_desc":
      query = query.order("price_paisa", { ascending: false }).order("title");
      break;
    case "featured":
      query = query.order("featured", { ascending: false }).order("title");
      break;
    default:
      query = query.order("title", { ascending: true });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data || []) as ListingRow[];
  const ids = rows.map((r) => r.id);
  let mediaByProduct = new Map<string, { url: string; alt: string; position: number }[]>();
  if (ids.length) {
    const { data: media } = await supabase
      .from("product_media")
      .select("product_id, url, alt, position")
      .in("product_id", ids);
    mediaByProduct = new Map();
    for (const m of media || []) {
      const list = mediaByProduct.get(m.product_id) || [];
      list.push({ url: m.url, alt: m.alt, position: m.position });
      mediaByProduct.set(m.product_id, list);
    }
  }

  return {
    products: rows.map((r) => mapListing(r, mediaByProduct.get(r.id) || [])),
    total: count ?? rows.length,
    limit,
    offset,
  };
}

export async function listRelatedProducts(product: PublicProduct, limit = 4): Promise<PublicProduct[]> {
  const supabase = await createClient();
  let query = supabase.from("public_catalog_listing").select("*").neq("handle", product.handle).limit(24);
  if (product.manufacturer && !/laptops hub/i.test(product.manufacturer)) {
    query = query.eq("manufacturer", product.manufacturer);
  } else if (product.category) {
    query = query.eq("category", product.category);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as ListingRow[];
  return rows.slice(0, limit).map((r) => mapListing(r));
}

/** Removed: privileged counts must only run after requireStaff() inside /admin pages. */
