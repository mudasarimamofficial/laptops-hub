import { createClient } from "@/lib/supabase/server";
import { modelName, publicDescription, publicTags, toPublicSpecs } from "@/lib/catalog/specs";
import type { PublicProduct, PublicVariant } from "@/types/catalog";

type Db = Pick<Awaited<ReturnType<typeof createClient>>, "from" | "rpc">;
type MediaItem = { url: string; alt: string; position: number };

type ProductRow = {
  id: string;
  handle: string;
  title: string;
  description_safe: string;
  seo_title: string | null;
  seo_description: string | null;
  manufacturer: string | null;
  product_type: string | null;
  category: string | null;
  featured: boolean;
  tags: string[] | null;
  specs: Record<string, unknown> | null;
  option_names: string[] | null;
  product_variants: {
    id: string;
    sku: string | null;
    title: string;
    option_values: Record<string, string> | null;
    price_paisa: number;
    compare_at_paisa: number | null;
    max_per_order: number;
    purchasable: boolean;
    position: number;
    media_id: string | null;
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

function sortMedia(list: { url: string; alt: string | null; position: number }[], fallbackAlt: string): MediaItem[] {
  return list
    .filter((m) => typeof m.url === "string" && m.url.trim() !== "")
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ url: m.url, alt: m.alt || fallbackAlt, position: m.position }));
}

function mapVariants(rows: ProductRow["product_variants"]): PublicVariant[] {
  return (rows || [])
    .filter((v) => v.purchasable && v.price_paisa > 0)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id))
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title || "Default",
      optionValues: v.option_values || {},
      pricePaisa: v.price_paisa,
      compareAtPaisa: v.compare_at_paisa,
      maxPerOrder: v.max_per_order,
      // Real stock is applied by applyAvailability() (storefront_variant_availability); the server re-checks at commit.
      available: true,
      mediaId: v.media_id ?? null,
    }));
}

/**
 * Pick the product-level defaults from the variant list: the first AVAILABLE variant by position (else the first),
 * so the PDP never opens on a sold-out option when another can be bought. Cards show the lowest purchasable price.
 */
function withDefaults(base: Omit<PublicProduct, "variantId" | "sku" | "pricePaisa" | "compareAtPaisa" | "maxPerOrder" | "available" | "variantCount" | "fromPricePaisa">, variants: PublicVariant[]): PublicProduct | null {
  if (!variants.length) return null;
  const def = variants.find((v) => v.available) ?? variants[0];
  const buyable = variants.filter((v) => v.available);
  return {
    ...base,
    variants,
    variantId: def.id,
    sku: def.sku,
    pricePaisa: def.pricePaisa,
    compareAtPaisa: def.compareAtPaisa,
    maxPerOrder: def.maxPerOrder,
    available: def.available,
    variantCount: variants.length,
    fromPricePaisa: Math.min(...(buyable.length ? buyable : variants).map((v) => v.pricePaisa)),
  };
}

function mapProduct(row: ProductRow): PublicProduct | null {
  return withDefaults(
    {
      id: row.id,
      handle: row.handle,
      title: row.title,
      descriptionSafe: publicDescription(row.description_safe),
      seoTitle: row.seo_title?.trim() || null,
      seoDescription: row.seo_description?.trim() || null,
      manufacturer: row.manufacturer,
      productType: row.product_type,
      category: row.category,
      featured: row.featured,
      tags: publicTags(row.tags),
      specs: toPublicSpecs(row.specs),
      optionNames: row.option_names || [],
      variants: [],
      images: sortMedia(row.product_media || [], row.title),
    },
    mapVariants(row.product_variants),
  );
}

function mapListing(row: ListingRow, media: { url: string; alt: string | null; position: number }[] = []): PublicProduct {
  const singleVariant: PublicVariant = {
    id: row.variant_id,
    sku: row.sku,
    title: "Default",
    optionValues: {},
    pricePaisa: row.price_paisa,
    compareAtPaisa: row.compare_at_paisa,
    maxPerOrder: row.max_per_order,
    // public_catalog_listing only returns purchasable variants with a price; stock comes from applyAvailability().
    available: true,
    mediaId: null,
  };
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    descriptionSafe: publicDescription(row.description_safe),
    seoTitle: null,
    seoDescription: null,
    manufacturer: row.manufacturer,
    productType: row.product_type,
    category: row.category,
    featured: row.featured,
    tags: publicTags(row.tags),
    specs: toPublicSpecs(row.specs),
    optionNames: [],
    variants: [singleVariant],
    variantId: row.variant_id,
    sku: row.sku,
    pricePaisa: row.price_paisa,
    compareAtPaisa: row.compare_at_paisa,
    maxPerOrder: row.max_per_order,
    available: true,
    // Corrected by applyAvailability(): the listing view exposes one (cheapest) variant per product.
    variantCount: 1,
    fromPricePaisa: row.price_paisa,
    images: sortMedia(media, row.title),
  };
}

type AvailabilityRow = { product_id: string; variant_id: string; available: boolean };

/**
 * Boolean-only stock per purchasable variant (never quantities) from `storefront_variant_availability`.
 * Returns null when the function is unavailable (database without migration 20261117150000): callers then keep the
 * previous behaviour (every purchasable variant offered) — create_cod_order still refuses insufficient stock.
 */
async function loadAvailability(supabase: Db, ids: string[]): Promise<Map<string, AvailabilityRow[]> | null> {
  const map = new Map<string, AvailabilityRow[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc("storefront_variant_availability", { p_product_ids: ids.slice(i, i + 200) });
    if (error || !Array.isArray(data)) return null;
    // Unexpected shape (e.g. an older function definition): unknown is not "sold out" — keep the previous behaviour.
    if (data.length && typeof (data[0] as Partial<AvailabilityRow>).product_id !== "string") return null;
    for (const r of data as AvailabilityRow[]) {
      const list = map.get(r.product_id) || [];
      list.push(r);
      map.set(r.product_id, list);
    }
  }
  return map;
}

/**
 * Apply real stock. "full": products loaded with all variants (PDP, catalog, collections) — every variant gets its
 * own flag and the defaults move to the first available variant. "listing": public_catalog_listing rows that carry
 * one representative variant — the card learns how many purchasable variants exist and whether any can be bought.
 */
async function applyAvailability(supabase: Db, products: PublicProduct[], mode: "full" | "listing"): Promise<PublicProduct[]> {
  if (!products.length) return products;
  const stock = await loadAvailability(supabase, products.map((p) => p.id));
  if (!stock) return products;
  return products.flatMap((p) => {
    const rows = stock.get(p.id) || [];
    const byVariant = new Map(rows.map((r) => [r.variant_id, r.available]));
    if (mode === "full") {
      // A variant absent from the result is not purchasable right now.
      const next = withDefaults(p, p.variants.map((v) => ({ ...v, available: byVariant.get(v.id) === true })));
      return next ? [next] : [];
    }
    const selfAvailable = byVariant.get(p.variantId) === true;
    const variantCount = Math.max(rows.length, 1);
    return [{
      ...p,
      variants: p.variants.map((v) => ({ ...v, available: selfAvailable })),
      available: variantCount > 1 ? rows.some((r) => r.available) : selfAvailable,
      variantCount,
    }];
  });
}

/**
 * One query for all media of a set of products (no N+1).
 * RLS `media_public_select` limits rows to active products.
 * A media error degrades to "no images" (cards render their no-image state) rather than failing the page.
 */
async function loadMediaByProduct(supabase: Db, ids: string[]) {
  const map = new Map<string, { url: string; alt: string | null; position: number }[]>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from("product_media")
    .select("product_id, url, alt, position")
    .in("product_id", ids);
  if (error || !data) return map;
  for (const m of data as { product_id: string; url: string; alt: string | null; position: number }[]) {
    const list = map.get(m.product_id) || [];
    list.push({ url: m.url, alt: m.alt, position: m.position });
    map.set(m.product_id, list);
  }
  return map;
}

const productSelect = `
  id, handle, title, description_safe, seo_title, seo_description, manufacturer, product_type, category,
  featured, tags, specs, option_names,
  product_variants ( id, sku, title, option_values, price_paisa, compare_at_paisa, max_per_order, purchasable, position, media_id ),
  product_media ( url, alt, position )
`;

/**
 * Column set readable by public roles before migrations 20261025120000 (option_names/position/media_id) and
 * 20261117140000 (their grants). Used only if the full select is refused, so a code deploy that lands ahead of the
 * migrations degrades to single-default-variant pages instead of failing every product page with 500.
 */
const legacyProductSelect = `
  id, handle, title, description_safe, manufacturer, product_type, category,
  featured, tags, specs,
  product_variants ( id, sku, title, option_values, price_paisa, compare_at_paisa, max_per_order, purchasable ),
  product_media ( url, alt, position )
`;

/** 42703 undefined column (schema behind) · 42501 insufficient privilege (grants behind). */
function isSchemaBehind(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "42501";
}

async function selectProducts<T>(run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>) {
  const first = await run(productSelect);
  if (!isSchemaBehind(first.error)) return first;
  console.warn("[catalog] full product select refused (" + first.error?.code + "); using legacy columns until migrations are applied");
  return run(legacyProductSelect);
}

const PAGE = 100;

/** Paginate through the entire active catalog (no hard 226 cap). */
export async function listAllPublicProducts(db?: Db): Promise<PublicProduct[]> {
  const supabase = db ?? (await createClient());
  const out: PublicProduct[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await selectProducts((cols) =>
      supabase.from("products").select(cols).eq("status", "active").order("title").range(offset, offset + PAGE - 1),
    );
    if (error) throw error;
    const batch = (data as ProductRow[] | null)?.map(mapProduct).filter(Boolean) as PublicProduct[];
    out.push(...(batch || []));
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return applyAvailability(supabase, out, "full");
}

export async function listPublicProducts(limit = 48, offset = 0): Promise<PublicProduct[]> {
  const supabase = await createClient();
  const { data, error } = await selectProducts((cols) =>
    supabase.from("products").select(cols).eq("status", "active").order("title").range(offset, offset + limit - 1),
  );
  if (error) throw error;
  return applyAvailability(supabase, ((data as ProductRow[] | null)?.map(mapProduct).filter(Boolean) as PublicProduct[]) || [], "full");
}

export async function getPublicProductByHandle(handle: string): Promise<PublicProduct | null> {
  const supabase = await createClient();
  const { data, error } = await selectProducts((cols) =>
    supabase.from("products").select(cols).eq("handle", handle).eq("status", "active").maybeSingle(),
  );
  if (error) throw error;
  if (!data) return null;
  const product = mapProduct(data as ProductRow);
  if (!product) return null;
  return (await applyAvailability(supabase, [product], "full"))[0] ?? null;
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
  const mediaByProduct = await loadMediaByProduct(supabase, rows.map((r) => r.id));

  return {
    products: await applyAvailability(supabase, rows.map((r) => mapListing(r, mediaByProduct.get(r.id) || [])), "listing"),
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
  const picked = ((data || []) as ListingRow[]).slice(0, limit);
  const mediaByProduct = await loadMediaByProduct(supabase, picked.map((r) => r.id));
  return applyAvailability(supabase, picked.map((r) => mapListing(r, mediaByProduct.get(r.id) || [])), "listing");
}

export type CompareSummary = {
  handle: string;
  title: string;
  model: string;
  imageUrl: string | null;
  imageAlt: string;
};

/**
 * Minimal public summaries for the compare tray. Reads the public listing view, so
 * draft/archived/non-purchasable handles are simply absent from the result. Two queries total.
 */
export async function listCompareSummaries(handles: string[]): Promise<CompareSummary[]> {
  if (!handles.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_catalog_listing")
    .select("id, handle, title, specs")
    .in("handle", handles);
  if (error) throw error;
  const rows = (data || []) as Pick<ListingRow, "id" | "handle" | "title" | "specs">[];
  const mediaByProduct = await loadMediaByProduct(supabase, rows.map((r) => r.id));
  const byHandle = new Map(rows.map((r) => [r.handle, r]));
  return handles.flatMap((h) => {
    const r = byHandle.get(h);
    if (!r) return [];
    const img = sortMedia(mediaByProduct.get(r.id) || [], r.title)[0];
    return [
      {
        handle: r.handle,
        title: r.title,
        model: modelName(r.title, toPublicSpecs(r.specs)),
        imageUrl: img?.url ?? null,
        imageAlt: img?.alt || r.title,
      },
    ];
  });
}

/** Removed: privileged counts must only run after requireStaff() inside /admin pages. */
