import { notFound } from "next/navigation";
import { ProductCard } from "@/components/commerce/product-card";
import { listPublicProducts } from "@/lib/catalog/queries";

export const revalidate = 60;

const RULES: Record<string, (p: Awaited<ReturnType<typeof listPublicProducts>>[number]) => boolean> = {
  laptops: (p) => /laptop|macbook|chromebook|gaming/i.test(p.productType || "") || /laptop/i.test(p.category || ""),
  accessories: (p) => /accessor/i.test(p.productType || "") || /accessor/i.test(p.category || ""),
  chargers: (p) => /charger|adapter/i.test(p.title) || (p.tags || []).some((t) => /charger/i.test(t)),
  chromebooks: (p) => /chromebook/i.test(p.title) && !/charger/i.test(p.title),
  tablets: (p) => /tablet|smart device/i.test(p.productType || "") || /tablet/i.test(p.category || ""),
  dell: (p) => /dell/i.test(p.manufacturer || "") || /^dell/i.test(p.title),
  hp: (p) => /^(hp|hewlett)/i.test(p.manufacturer || "") || /\bhp\b/i.test(p.title),
  lenovo: (p) => /lenovo/i.test(p.manufacturer || "") || /lenovo/i.test(p.title),
  apple: (p) => /apple/i.test(p.manufacturer || "") || /macbook/i.test(p.title),
  gaming: (p) => /gaming/i.test(p.productType || "") || /gaming/i.test(p.title),
  macbooks: (p) => /macbook/i.test(p.title),
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "all") notFound();
  const rule = RULES[slug];
  if (!rule) notFound();

  const all = await listPublicProducts(226);
  const products = all.filter(rule);

  return (
    <div className="lh-container py-12">
      <p className="lh-kicker">Collection</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold capitalize tracking-[-0.04em]">
        {slug.replace(/-/g, " ")}
      </h1>
      <p className="mt-2 text-[var(--lh-ink-2)]">{products.length} products</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
