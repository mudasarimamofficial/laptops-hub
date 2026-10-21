import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/commerce/product-card";
import { resolveCollection } from "@/lib/collections/resolve";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const col = await resolveCollection(slug, { limit: 1 }).catch(() => null);
  return { title: col?.title || slug.replace(/-/g, " ") };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (slug === "all") notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || "1") || 1);
  const pageSize = 48;
  const col = await resolveCollection(slug, { limit: pageSize, offset: (page - 1) * pageSize });
  if (!col) notFound();

  const pages = Math.max(1, Math.ceil(col.total / pageSize));

  return (
    <div className="lh-container py-12">
      <p className="lh-kicker">Collection</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">{col.title}</h1>
      <p className="mt-2 max-w-2xl text-[var(--lh-ink-2)]">
        {col.description} · {col.total} products
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {col.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {col.products.length === 0 ? (
        <p className="mt-10 text-[var(--lh-ink-2)]">No products match this collection yet.</p>
      ) : null}
      {pages > 1 ? (
        <div className="mt-8 flex gap-4 text-sm">
          {page > 1 ? (
            <Link href={`/collections/${slug}?page=${page - 1}`} className="text-[var(--lh-action)]">
              ← Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={`/collections/${slug}?page=${page + 1}`} className="text-[var(--lh-action)]">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
