import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { CompareToggle } from "@/components/commerce/compare-toggle";
import { ProductInquiry } from "@/components/commerce/inquiry-dialog";
import { ProductGallery } from "@/components/commerce/product-gallery";
import { ProductCard } from "@/components/commerce/product-card";
import { getPublicProductByHandle, listRelatedProducts } from "@/lib/catalog/queries";
import { canPurchase } from "@/lib/catalog/availability";
import { curateSpecs, publicDescription } from "@/lib/catalog/specs";
import { formatPkr } from "@/lib/money";

export const revalidate = 60;

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  const product = await getPublicProductByHandle(handle);
  if (!product) return { title: "Product not found" };
  return {
    title: product.title,
    description: publicDescription(product.descriptionSafe).slice(0, 160) || `${product.title} · Cash on Delivery`,
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
  const purchasable = canPurchase(product);
  const specRows = curateSpecs(product);
  const description = publicDescription(product.descriptionSafe);

  return (
    <div className="lh-container py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />

        <div className="min-w-0">
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
          {purchasable ? (
            <p className="mt-2 text-sm text-[var(--lh-ink-2)]">Cash on Delivery · pay when delivered</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {purchasable ? (
              <AddToCartButton
                available={purchasable}
                line={{
                  variantId: product.variantId,
                  handle: product.handle,
                  title: product.title,
                  unitPricePaisa: product.pricePaisa,
                  quantity: 1,
                  imageUrl: primary?.url,
                  maxPerOrder: product.maxPerOrder,
                }}
                max={product.maxPerOrder}
              />
            ) : (
              <ProductInquiry productTitle={product.title} productHandle={product.handle} />
            )}
            <CompareToggle handle={product.handle} />
          </div>

          {description ? (
            <div className="mt-10 whitespace-pre-wrap text-sm leading-relaxed text-[var(--lh-ink-2)]">{description}</div>
          ) : null}

          {specRows.length ? (
            <section aria-labelledby="pdp-specs" className="mt-10">
              <h2
                id="pdp-specs"
                className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]"
              >
                Specifications
              </h2>
              <dl className="m-0 mt-4 overflow-hidden rounded-[18px] border border-[var(--lh-border)] bg-white">
                {specRows.map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-[minmax(110px,32%)_minmax(0,1fr)] gap-4 border-b border-[var(--lh-divider)] px-[18px] py-3.5 last:border-b-0"
                  >
                    <dt className="pt-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--lh-ink-2)]">
                      {r.label}
                    </dt>
                    <dd className="m-0 text-[15px] leading-snug text-[var(--lh-ink)] [overflow-wrap:anywhere]">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
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
