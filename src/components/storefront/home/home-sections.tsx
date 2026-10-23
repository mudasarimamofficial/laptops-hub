import Link from "next/link";
import { ProductCard } from "@/components/commerce/product-card";
import type { PublicProduct } from "@/types/catalog";
import { formatPkr } from "@/lib/money";

export function BrandSection({
  brands,
}: {
  brands: { slug: string; name: string; count: number }[];
}) {
  return (
    <section id="brands" className="lh-container py-[var(--lh-section)]">
      <p className="lh-kicker">Shop by brand</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-[-0.035em]">
        Trusted makers, clear listings.
      </h2>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {brands.map((b) => (
          <Link
            key={b.slug}
            href={`/collections/${b.slug}`}
            className="rounded-[20px] border border-[var(--lh-border)] bg-white p-5 transition hover:border-[var(--lh-action)]/40"
          >
            <span className="font-[family-name:var(--font-display)] text-xl font-bold">{b.name}</span>
            <span className="mt-1 block font-[family-name:var(--font-mono)] text-xs text-[var(--lh-ink-2)]">
              {b.count} products
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FeaturedSection({ products }: { products: PublicProduct[] }) {
  return (
    <section className="bg-[linear-gradient(180deg,var(--lh-canvas),#FFFFFF_40%,var(--lh-ice))] py-[var(--lh-section)]">
      <div className="lh-container">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="lh-kicker">Featured</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-[-0.035em]">
              Ready to compare.
            </h2>
          </div>
          <Link href="/collections/all" className="text-sm font-semibold text-[var(--lh-action)]">
            View all →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function BudgetSection() {
  const tiers = [
    { href: "/collections/under-40k", title: "Under Rs 40,000", blurb: "Everyday machines for study and work." },
    { href: "/collections/40k-60k", title: "Rs 40k – 60k", blurb: "Balanced performance and portability." },
    { href: "/collections/over-60k", title: "Over Rs 60,000", blurb: "Higher specs for demanding workflows." },
  ];
  return (
    <section className="lh-container py-[var(--lh-section)]">
      <p className="lh-kicker">Shop by budget</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-[-0.035em]">
        Pick a range. Filter further later.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-[24px] border border-[var(--lh-border)] bg-white p-6 transition hover:border-[var(--lh-action)]/35"
          >
            <h3 className="font-[family-name:var(--font-display)] text-xl font-bold">{t.title}</h3>
            <p className="mt-2 text-sm text-[var(--lh-ink-2)]">{t.blurb}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ChromebookSection({
  product,
  blurb,
}: {
  product: PublicProduct | null;
  blurb: string;
}) {
  return (
    <section
      id="chromebooks"
      aria-label="Chromebooks"
      className="relative overflow-hidden bg-[linear-gradient(180deg,var(--lh-canvas)_0%,#FFFFFF_45%,var(--lh-ice)_100%)] py-[var(--lh-section)]"
    >
      <div className="lh-container grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--lh-navy)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] text-white">
              03 — CHROMEBOOKS
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] text-[var(--lh-ink-2)]">
              NOW LISTED
            </span>
          </div>
          <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(2.2rem,4.8vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.05em]">
            Chromebooks, made for <span className="text-[var(--lh-action)]">everyday speed.</span>
          </h2>
          <p className="m-0 max-w-[48ch] text-[clamp(1rem,1.2vw,1.125rem)] leading-relaxed text-[var(--lh-ink-2)]">
            {blurb}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/collections/chromebooks"
              className="inline-flex h-[54px] items-center gap-2.5 rounded-full bg-[var(--lh-action)] px-[26px] text-[15px] font-bold text-white shadow-[0_16px_36px_-16px_rgba(33,89,212,.85)]"
            >
              View Chromebook collection <span aria-hidden>→</span>
            </Link>
            <Link
              href="/pages/contact"
              className="inline-flex h-[54px] items-center rounded-full border border-[var(--lh-border)] bg-white px-6 text-[15px] font-semibold"
            >
              Ask about Chromebooks
            </Link>
          </div>
        </div>
        <div className="relative min-h-[280px] aspect-[5/4]">
          <div className="absolute inset-[6%_4%] rounded-[40px] border border-white bg-[linear-gradient(160deg,rgba(255,255,255,.9),rgba(232,242,255,.55))] shadow-[0_50px_100px_-50px_rgba(33,89,212,.5)]" />
          {product ? (
            <div className="absolute inset-[18%_16%_28%] flex flex-col items-center justify-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.images[0]?.url}
                alt={product.title}
                className="max-h-full max-w-full object-contain mix-blend-multiply"
              />
              <div className="rounded-2xl border border-white bg-white/94 px-3.5 py-3 shadow-lg">
                <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] text-[var(--lh-action)]">
                  NOW LISTED
                </p>
                <p className="text-sm font-semibold">{product.title}</p>
                <p className="text-sm font-bold">{formatPkr(product.pricePaisa)}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function CompareTeaser() {
  return (
    <section className="lh-container py-[var(--lh-section)]">
      <div className="overflow-hidden rounded-[32px] bg-[var(--lh-navy)] px-6 py-12 text-white md:px-12">
        <p className="font-[family-name:var(--font-mono)] text-xs tracking-[0.14em] text-[var(--lh-electric)]">
          COMPARE
        </p>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-[-0.04em]">
          Put up to four machines side by side.
        </h2>
        <p className="mt-3 max-w-lg text-white/70">
          Add products from any listing or product page. Specs and prices stay aligned — no inventory counts shown.
        </p>
        <Link
          href="/compare"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-bold text-[var(--lh-ink)]"
        >
          Open compare
        </Link>
      </div>
    </section>
  );
}
