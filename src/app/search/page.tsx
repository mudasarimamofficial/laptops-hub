import Link from "next/link";
import { ProductCard } from "@/components/commerce/product-card";
import { filterPublicProducts } from "@/lib/catalog/queries";
import { pkrMajorToPaisa } from "@/lib/money";
import { COLLECTION_DEFS } from "@/lib/collections/definitions";

type Props = {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    category?: string;
    min?: string;
    max?: string;
    sort?: string;
    page?: string;
  }>;
};

const BRANDS = ["Dell", "HP", "Lenovo", "Apple", "Microsoft", "Acer", "Asus"];
const PAGE_SIZE = 48;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q || "";
  const brand = sp.brand || "";
  const category = sp.category || "";
  const min = sp.min ? Number(sp.min) : undefined;
  const max = sp.max ? Number(sp.max) : undefined;
  const sort = (sp.sort as "price_asc" | "price_desc" | "title" | "featured") || "title";
  const page = Math.max(1, Number(sp.page || "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const hasFilters = !!(q || brand || category || min != null || max != null);
  const result = hasFilters
    ? await filterPublicProducts({
        q,
        brand: brand || undefined,
        category: category || undefined,
        minPaisa: min != null && Number.isFinite(min) ? pkrMajorToPaisa(min) : undefined,
        maxPaisa: max != null && Number.isFinite(max) ? pkrMajorToPaisa(max) : undefined,
        sort,
        limit: PAGE_SIZE,
        offset,
      })
    : { products: [], total: 0, limit: PAGE_SIZE, offset: 0 };

  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const categories = Array.from(
    new Set(
      COLLECTION_DEFS.filter((c) => !["under-40k", "40k-60k", "over-60k"].includes(c.slug)).map((c) => c.title),
    ),
  );

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (brand) u.set("brand", brand);
    if (category) u.set("category", category);
    if (sp.min) u.set("min", sp.min);
    if (sp.max) u.set("max", sp.max);
    if (sort) u.set("sort", sort);
    u.set("page", String(p));
    return `/search?${u.toString()}`;
  };

  return (
    <div className="lh-container py-12">
      <p className="lh-kicker">Search</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        {q ? `Results for “${q}”` : "Find a product"}
      </h1>
      {hasFilters ? (
        <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
          {result.total} match{result.total === 1 ? "" : "es"} · page {page} of {pages}
        </p>
      ) : null}

      <form
        className="mt-8 grid gap-4 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5 md:grid-cols-2 lg:grid-cols-3"
        action="/search"
        method="get"
      >
        <label className="block text-sm md:col-span-2 lg:col-span-3">
          <span className="font-medium">Keywords</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Model, brand, or keywords"
            className="mt-1 w-full rounded-[var(--lh-radius-pill)] border border-[var(--lh-border)] px-5 py-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Brand</span>
          <select name="brand" defaultValue={brand} className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2">
            <option value="">Any brand</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Category</span>
          <select
            name="category"
            defaultValue={category}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          >
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Sort</span>
          <select name="sort" defaultValue={sort} className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2">
            <option value="title">Name</option>
            <option value="price_asc">Price · low to high</option>
            <option value="price_desc">Price · high to low</option>
            <option value="featured">Featured first</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Min PKR</span>
          <input
            name="min"
            type="number"
            min={0}
            defaultValue={sp.min || ""}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Max PKR</span>
          <input
            name="max"
            type="number"
            min={0}
            defaultValue={sp.max || ""}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-2 lg:col-span-3">
          <button
            type="submit"
            className="rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
          <Link href="/search" className="text-sm text-[var(--lh-action)]">
            Clear filters
          </Link>
        </div>
      </form>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {result.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {hasFilters && result.products.length === 0 ? (
        <div className="mt-10 rounded-[var(--lh-radius-card)] border border-dashed border-[var(--lh-border)] bg-[var(--lh-ice)] p-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">No matching products</p>
          <p className="mt-2 text-sm text-[var(--lh-ink-2)]">Try a different brand, price range, or browse collections.</p>
          <Link href="/collections/laptops" className="mt-4 inline-block text-sm text-[var(--lh-action)]">
            Browse laptops →
          </Link>
        </div>
      ) : null}
      {!hasFilters ? (
        <p className="mt-8 text-[var(--lh-ink-2)]">Enter a search or choose filters to browse the catalog.</p>
      ) : null}

      {hasFilters && pages > 1 ? (
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          {page > 1 ? (
            <Link href={qs(page - 1)} className="text-[var(--lh-action)]">
              ← Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={qs(page + 1)} className="text-[var(--lh-action)]">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
