import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { V5ProductCard } from "@/components/commerce/product-card";
import { ProductBuy, ProductGallery } from "@/components/commerce/product-detail";
import { fmtPkr, getV5Catalog, V5_COLS, v5Card, v5KeySpecs, v5Related, v5SpecRows } from "@/lib/catalog/v5";

export const revalidate = 60;

type Props = { params: Promise<{ handle: string }> };

/** Public products only: drafts and archived listings are never in the catalog, so they 404. */
async function load(handle: string) {
  const P = await getV5Catalog();
  const p = P.find((x) => x.h === handle);
  return p ? { P, p } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const r = await load(handle).catch(() => null);
  if (!r) return { title: "Product not found", robots: { index: false } };
  const { p } = r;
  const description = (p.intro.split(/\n\s*\n/)[0] || `${p.model}${p.config ? ", " + p.config : ""}`).slice(0, 160);
  return {
    title: p.t,
    description,
    alternates: { canonical: `/products/${p.h}` },
    openGraph: { title: p.t, description, images: p.imgs[0] ? [{ url: p.imgs[0].u }] : undefined, type: "website" },
  };
}

const crumbLink = { color: "var(--lh-ink-2)" } as const;
const h2 = { margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(26px,2.6vw,36px)", letterSpacing: "-.03em", fontWeight: 700 } as const;
const POLICIES = [
  { label: "Delivery", href: "/pages/shipping" },
  { label: "Returns", href: "/pages/returns" },
  { label: "Warranty", href: "/pages/warranty" },
];

/** Port of the V5 product template (`isProduct`). */
export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const r = await load(handle);
  if (!r) notFound();
  const { P, p } = r;
  const bid = p.brand.toLowerCase();
  const brandHref = V5_COLS[bid] ? `/collections/${bid}` : `/search?q=${encodeURIComponent(p.brand)}`;
  const intro = p.intro.trim() || `${p.model}${p.config ? ", " + p.config : ""}. Listed in ${(p.sub || p.catLabel).toLowerCase()}s by ${p.brand}.`;
  const outro = p.intro.trim() ? "" : "Full specifications for this listing are being prepared. Ask us for any detail before you order.";
  const related = v5Related(P, p);

  // Structured data from verified listing fields only (no stock, rating or delivery claims).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.t,
    sku: p.sku || undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    image: p.imgs.slice(0, 4).map((x) => x.u),
    offers: {
      "@type": "Offer",
      price: (p.pricePaisa / 100).toFixed(2),
      priceCurrency: "PKR",
      itemCondition: p.cond === "Used" ? "https://schema.org/UsedCondition" : undefined,
      url: `/products/${p.h}`,
    },
  };

  return (
    <section data-screen-label="Product" style={{ maxWidth: 1360, margin: "0 auto", padding: "24px clamp(16px,3vw,32px) 80px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13, color: "var(--lh-ink-2)", marginBottom: 20 }}>
        <Link href="/" style={crumbLink}>
          Home
        </Link>
        <span>/</span>
        <Link href={brandHref} style={crumbLink}>
          {p.brand}
        </Link>
        <span>/</span>
        <span style={{ color: "var(--lh-ink)" }}>{p.model}</span>
      </nav>
      <div className="v5-pdp-cols" style={{ display: "grid", gap: "clamp(20px,3vw,48px)", alignItems: "start" }}>
        <div className="v5-pdp-gallery" style={{ display: "flex", flexDirection: "column", gap: 14, top: 96, minWidth: 0 }}>
          <ProductGallery images={p.imgs.map((x) => x.u)} model={p.model} config={p.config} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lh-action)" }}>{p.brand}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "var(--lh-divider)", color: "var(--lh-ink)" }}>{p.cond || "Condition not listed"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" }}>{p.sku}</span>
            </div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(30px,3.4vw,48px)", lineHeight: 1.04, letterSpacing: "-.04em", fontWeight: 700, textWrap: "balance" }}>{p.model}</h1>
            <p style={{ margin: 0, fontSize: 17, color: "var(--lh-ink-2)", lineHeight: 1.45 }}>{p.config}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 22, borderRadius: 24, background: "#FFFFFF", border: "1px solid var(--lh-border)", boxShadow: "0 24px 50px -36px rgba(var(--lh-navy-rgb),.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, letterSpacing: "-.03em" }}>{fmtPkr(p.pricePaisa)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
              {v5KeySpecs(p).map((k) => (
                <div key={k.k} style={{ display: "flex", flexDirection: "column", gap: 5, padding: "12px 14px", borderRadius: 14, background: "var(--lh-canvas)", border: "1px solid var(--lh-divider)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)" }}>{k.k}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{k.v}</span>
                </div>
              ))}
            </div>
            <ProductBuy handle={p.h} title={p.t} model={p.model} config={p.config} sku={p.sku} variantId={p.variantId} pricePaisa={p.pricePaisa} maxPerOrder={p.maxPerOrder} available={p.avail} imageUrl={p.imgs[0]?.u ?? null} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 8 }}>
            {POLICIES.map((pl) => (
              <Link key={pl.href} href={pl.href} className="v5-hov-bd-action" style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", borderRadius: 14, background: "#FFFFFF", border: "1px solid var(--lh-border)", color: "var(--lh-ink)" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{pl.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", color: "var(--lh-warning)" }}>BEING FINALISED</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="v5-pdp-cols" style={{ marginTop: 64, borderRadius: 30, backgroundColor: "var(--lh-navy)", backgroundImage: "radial-gradient(50% 80% at 100% 0%,rgba(var(--lh-iris-rgb),.28),transparent 70%),radial-gradient(40% 60% at 0% 100%,rgba(var(--lh-action-rgb),.28),transparent 70%)", color: "#FFFFFF", padding: "clamp(24px,4vw,48px)", display: "grid", gap: "clamp(24px,4vw,56px)" }}>
        <section aria-labelledby="pdp-specs" style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".1em", color: "var(--lh-electric)" }}>SPEC SHEET</span>
          <h2 id="pdp-specs" style={h2}>
            Specifications
          </h2>
          <dl style={{ margin: 0, borderRadius: 18, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", overflow: "hidden" }}>
            {v5SpecRows(p).map((row) => (
              <div key={row.k} style={{ display: "grid", gridTemplateColumns: "minmax(110px,32%) minmax(0,1fr)", gap: 16, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                <dt style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lh-on-dark-3)", paddingTop: 2 }}>{row.k}</dt>
                <dd style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--lh-on-dark-2)" }}>{row.v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".1em", color: "var(--lh-electric)" }}>LISTING</span>
          <h2 style={h2}>About this listing</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--lh-on-dark-2)", textWrap: "pretty" }}>{intro}</p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--lh-on-dark-2)", textWrap: "pretty" }}>{outro}</p>
        </div>
      </div>

      <section aria-labelledby="pdp-related" style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <h2 id="pdp-related" style={h2}>
            More from {p.brand}
          </h2>
          <Link href={brandHref} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 700, fontSize: 15, color: "var(--lh-action)" }}>
            View all →
          </Link>
        </div>
        <div className="v5-card-grid">
          {related.map((x) => (
            <V5ProductCard key={x.h} item={v5Card(x)} />
          ))}
        </div>
      </section>
    </section>
  );
}
