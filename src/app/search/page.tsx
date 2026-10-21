import { ProductCard } from "@/components/commerce/product-card";
import { searchPublicProducts } from "@/lib/catalog/queries";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const products = q ? await searchPublicProducts(q) : [];

  return (
    <div className="lh-container py-12">
      <p className="lh-kicker">Search</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        {q ? `Results for “${q}”` : "Search"}
      </h1>
      <form className="mt-6" action="/search" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products"
          className="w-full max-w-xl rounded-[var(--lh-radius-pill)] border border-[var(--lh-border)] bg-white px-5 py-3"
        />
      </form>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {q && products.length === 0 ? (
        <p className="mt-8 text-[var(--lh-ink-2)]">No matching products.</p>
      ) : null}
    </div>
  );
}
