import { ProductCard } from "@/components/commerce/product-card";
import { PendingBlock } from "@/components/ui/pending-block";
import { countPublicProducts, listPublicProducts } from "@/lib/catalog/queries";

export const revalidate = 60;
export const metadata = { title: "All products" };

export default async function AllProductsPage() {
  let products: Awaited<ReturnType<typeof listPublicProducts>> = [];
  let count = 0;
  let error: string | null = null;
  try {
    [products, count] = await Promise.all([listPublicProducts(226), countPublicProducts()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  return (
    <div className="lh-container py-12">
      <p className="lh-kicker">Collection</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        All products
      </h1>
      <p className="mt-2 text-[var(--lh-ink-2)]">
        {error ? "—" : `${count} public products`} · no stock counts shown
      </p>

      {error ? (
        <div className="mt-8">
          <PendingBlock title="Catalog error">{error}</PendingBlock>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
