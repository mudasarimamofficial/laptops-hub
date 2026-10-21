import Link from "next/link";
import { ProductCard } from "@/components/commerce/product-card";
import { PendingBlock } from "@/components/ui/pending-block";
import { listPublicProducts, countPublicProducts } from "@/lib/catalog/queries";
import { formatPkr } from "@/lib/money";

export const revalidate = 60;

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof listPublicProducts>> = [];
  let count = 0;
  let catalogError: string | null = null;

  try {
    [products, count] = await Promise.all([listPublicProducts(8), countPublicProducts()]);
  } catch (e) {
    catalogError = e instanceof Error ? e.message : "Catalog unavailable";
  }

  const featured = products[0];

  return (
    <>
      <section className="relative overflow-hidden bg-[var(--lh-navy)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 70% 40%, color-mix(in srgb, var(--lh-electric) 35%, transparent), transparent 70%), radial-gradient(ellipse 40% 40% at 20% 80%, color-mix(in srgb, var(--lh-iris) 40%, transparent), transparent 65%)",
          }}
        />
        <div className="lh-container relative grid min-h-[min(86vh,760px)] items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="lh-kicker text-white/70">
              <span className="text-white/70">Pakistan · Cash on Delivery</span>
            </p>
            <h1 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
              Find your next machine
            </h1>
            <p className="mt-5 max-w-lg text-[1.05rem] leading-relaxed text-white/70">
              Curated laptops, Chromebooks and accessories with transparent COD checkout — pay when it arrives.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/collections/all" className="lh-btn lh-btn-primary">
                Shop {count > 0 ? `${count} products` : "catalog"}
              </Link>
              <Link href="/collections/chromebooks" className="lh-btn lh-btn-ghost">
                Chromebooks
              </Link>
            </div>
            {featured ? (
              <p className="mt-8 font-[family-name:var(--font-mono)] text-xs tracking-wide text-white/45">
                Featured from live catalog · {featured.title} · {formatPkr(featured.pricePaisa)}
              </p>
            ) : null}
          </div>
          <div className="relative min-h-[280px] rounded-[var(--lh-radius-frame)] border border-white/10 bg-[color-mix(in_srgb,var(--lh-titanium)_12%,transparent)] p-6 backdrop-blur-sm">
            <div className="absolute inset-6 rounded-[24px] bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--lh-electric)_25%,transparent),transparent_60%)]" />
            <div className="relative flex h-full flex-col justify-end gap-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--lh-electric)]">
                V5 cinematic stage
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                Scroll story &amp; cutouts port next
              </p>
              <p className="text-sm text-white/55">
                Design tokens, wordmark and sapphire CTAs match the frozen V5 system. Full pinned product story lands with
                media assets in reference/.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="lh-container py-[var(--lh-section)]">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="lh-kicker">Live catalog</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
              Fresh from Supabase
            </h2>
          </div>
          <Link href="/collections/all" className="text-sm font-semibold text-[var(--lh-action)]">
            View all →
          </Link>
        </div>

        {catalogError ? (
          <PendingBlock title="Catalog not connected yet">
            {catalogError}. Apply migrations and run <code>npm run import:catalog</code>.
          </PendingBlock>
        ) : products.length === 0 ? (
          <PendingBlock title="No public products yet">
            Import the 232-product catalog (226 public) before shopping flows go live.
          </PendingBlock>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="lh-content pb-[var(--lh-section)]">
        <PendingBlock title="Business policies & contact">
          Shipping fees, returns, warranty, store address and WhatsApp are owner-gated. Checkout stays disabled until
          shipping zones and COD terms are configured in admin.
        </PendingBlock>
      </section>
    </>
  );
}
