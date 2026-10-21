import Image from "next/image";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { getPublicProductByHandle } from "@/lib/catalog/queries";
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

  return (
    <div className="lh-container grid gap-10 py-12 lg:grid-cols-2">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-[var(--lh-radius-frame)] bg-[var(--lh-titanium)]">
          {primary ? (
            <Image
              src={primary.url}
              alt={primary.alt || product.title}
              fill
              className="object-contain p-8"
              sizes="(max-width:1024px) 100vw, 50vw"
              priority
              unoptimized
            />
          ) : null}
        </div>
        {product.images.length > 1 ? (
          <ul className="mt-4 grid grid-cols-5 gap-2">
            {product.images.slice(0, 5).map((img) => (
              <li key={img.position} className="relative aspect-square overflow-hidden rounded-xl bg-[var(--lh-ice)]">
                <Image src={img.url} alt="" fill className="object-contain p-2" sizes="80px" unoptimized />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        {product.manufacturer ? (
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--lh-ink-2)]">
            {product.manufacturer}
          </p>
        ) : null}
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] md:text-4xl">
          {product.title}
        </h1>
        <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.04em] text-[var(--lh-ink)]">
          {formatPkr(product.pricePaisa)}
        </p>
        <p className="mt-2 text-sm text-[var(--lh-ink-2)]">Cash on Delivery · pay when delivered</p>

        <div className="mt-8">
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
  );
}
