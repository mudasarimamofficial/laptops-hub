import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { CompareToggle } from "@/components/commerce/compare-toggle";
import { ProductGallery } from "@/components/commerce/product-gallery";
import { ProductCard } from "@/components/commerce/product-card";
import { getPublicProductByHandle, listRelatedProducts } from "@/lib/catalog/queries";
import { formatPkr } from "@/lib/money";

export const revalidate = 60;

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  const product = await getPublicProductByHandle(handle);
  if (!product) return { title: "Product not found" };
  return {
    title: product.title,
    description: product.descriptionSafe.slice(0, 160) || `${product.title} · Cash on Delivery`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getPublicProductByHandle(handle);
  if (!product) notFound();

  const primary = product.images[0];
  const manufacturer =
    product.manufacturer && !/laptops hub/i.test(product.manufacturer) ? product.manufacturer : null;
  const related = await listRelatedProducts(product).catch(() => []);

  return (
    <div className="lh-container py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />

        <div>
          {manufacturer ? (
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--lh-ink-2)]">
              {manufacturer}
            </p>
          ) : null}
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] md:text-4xl">
            {product.title}
          </h1>
          <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.04em] text-[var(--lh-ink)]">
            {formatPkr(product.pricePaisa)}
          </p>
          <p className="mt-2 text-sm text-[var(--lh-ink-2)]">Cash on Delivery · pay when delivered</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <AddToCartButton
              line={{
                variantId: product.variantId,
                handle: product.handle,
                title: product.title,
                unitPricePaisa: product.pricePaisa,
                quantity: 1,
                imageUrl: primary?.url,
              }}
              max={product.maxPerOrder}
            />
            <CompareToggle handle={product.handle} />
          </div>

          {product.descriptionSafe ? (
            <div className="mt-10 whitespace-pre-wrap text-sm leading-relaxed text-[var(--lh-ink-2)]">
              {product.descriptionSafe}
            </div>
          ) : null}

          {Object.keys(product.specs).length ? (
            <table className="mt-10 w-full text-sm">
              <tbody>
                {Object.entries(product.specs)
                  .filter(([, v]) => v != null && String(v).trim() !== "")
                  .slice(0, 16)
                  .map(([k, v]) => (
                    <tr key={k} className="border-t border-[var(--lh-divider)]">
                      <th className="py-2 pr-4 text-left font-medium capitalize text-[var(--lh-ink)]">{k}</th>
                      <td className="py-2 text-[var(--lh-ink-2)]">{String(v)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {related.length ? (
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">Related</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
