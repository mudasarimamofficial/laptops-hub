import { notFound } from "next/navigation";
import { ProductCard } from "@/components/commerce/product-card";
import { resolveCollection } from "@/lib/collections/resolve";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const col = await resolveCollection(slug).catch(() => null);
  return { title: col?.title || slug.replace(/-/g, " ") };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "all") notFound();
  const col = await resolveCollection(slug);
  if (!col) notFound();

  return (
    <div className="lh-container py-12">
      <p className="lh-kicker">Collection</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">{col.title}</h1>
      <p className="mt-2 max-w-2xl text-[var(--lh-ink-2)]">
        {col.description} · {col.products.length} products
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {col.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {col.products.length === 0 ? (
        <p className="mt-10 text-[var(--lh-ink-2)]">No products match this collection yet.</p>
      ) : null}
    </div>
  );
}
