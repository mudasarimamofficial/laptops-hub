"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicProduct } from "@/types/catalog";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { useCompare } from "@/lib/commerce/compare-store";
import { canPurchase } from "@/lib/catalog/availability";
import { toV5, v5Card, type V5Card } from "@/lib/catalog/v5-model";
import { InquiryDialog } from "@/components/commerce/inquiry-dialog";

/** Port of `ProductCard v5.dc.html`. Category badge only (no stock wording by design). */
export function V5ProductCard({ item }: { item: V5Card }) {
  const [hover, setHover] = useState(false);
  const [inquiring, setInquiring] = useState(false);
  const toggle = useCompare((s) => s.toggle);
  const compared = useCompare((s) => s.handles.includes(item.h));
  const add = useCart((s) => s.add);
  const purchasable = canPurchase({ available: item.avail, pricePaisa: item.pricePaisa, variantId: item.variantId });
  const img = hover && item.img2 ? item.img2 : item.img;
  const cmp = compared
    ? { label: "Comparing", tick: "✓", bd: "#2159D4", bg: "#EAF3FE", color: "#1748B5", box: "#2159D4", fill: "#2159D4" }
    : { label: "Compare", tick: "", bd: "#DAE5F2", bg: "#FFFFFF", color: "#102039", box: "#9AA7BA", fill: "transparent" };

  return (
    <article
      className="v5-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", background: "var(--lh-paper,#FFFFFF)", border: "1px solid var(--lh-border,#DAE5F2)", borderRadius: 18, overflow: "hidden", fontFamily: "var(--font-body)", color: "var(--lh-ink,#102039)", transition: "transform .22s ease,box-shadow .22s ease,border-color .22s ease" }}
    >
      <Link
        href={item.href}
        aria-label={item.title}
        style={{ position: "relative", display: "block", aspectRatio: "5/4", background: "linear-gradient(180deg,#FFFFFF 0%,#F3F7FD 62%,var(--lh-titanium,#DFEAF7) 100%)", overflow: "hidden" }}
      >
        <span aria-hidden="true" style={{ position: "absolute", left: "12%", right: "12%", bottom: "9%", height: "10%", borderRadius: "50%", background: "radial-gradient(closest-side,rgba(10,23,48,.16),transparent)" }} />
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- V5 card image; remote catalog CDN
          <img
            src={img}
            alt={item.alt}
            loading="lazy"
            decoding="async"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", padding: 18, mixBlendMode: "multiply", transform: hover ? "scale(1.03)" : "scale(1)", transition: "transform .35s ease" }}
          />
        ) : null}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 6, justifyContent: "space-between", alignItems: "flex-start", minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, background: "#FFFFFF", border: "1px solid #BCD0F2", color: "#1748B5", whiteSpace: "nowrap", flexShrink: 0 }}>
            <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: "#2159D4" }} />
            {item.badge}
          </span>
        </div>
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px 18px", flex: 1, borderTop: "1px solid var(--lh-border,#DAE5F2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lh-ink-2,#52637B)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {item.brand} · {item.cond}
          </span>
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-ink-2,#52637B)" }}>{item.sku}</span>
        </div>
        <Link href={item.href} style={{ color: "var(--lh-ink,#102039)", textDecoration: "none", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-.015em", textWrap: "pretty", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
            {item.model}
          </span>
          <span style={{ fontSize: 13, color: "var(--lh-ink-2,#52637B)", lineHeight: 1.4, textWrap: "pretty", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", minHeight: "2.8em" }}>
            {item.config}
          </span>
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {item.chips.map((chip) => (
            <span key={chip} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, padding: "4px 8px", borderRadius: 7, background: "var(--lh-ice,#EAF3FE)", color: "var(--lh-ink,#102039)", whiteSpace: "nowrap" }}>
              {chip}
            </span>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "8px 10px", paddingTop: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lh-ink-2,#52637B)" }}>Price</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", color: "var(--lh-ink,#102039)", whiteSpace: "nowrap" }}>{item.priceText}</span>
          </div>
          <button
            type="button"
            onClick={() => toggle(item.h)}
            aria-pressed={compared}
            style={{ height: 36, padding: "0 12px 0 10px", borderRadius: 10, border: `1px solid ${cmp.bd}`, background: cmp.bg, color: cmp.color, font: "600 12px var(--font-body)", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, transition: "all .18s ease" }}
          >
            <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${cmp.box}`, background: cmp.fill, color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 10, lineHeight: 1 }}>
              {cmp.tick}
            </span>
            {cmp.label}
          </button>
        </div>
        {purchasable ? (
          <button
            type="button"
            className="v5-card-atc"
            onClick={() => {
              add({ variantId: item.variantId, handle: item.h, title: item.title, unitPricePaisa: item.pricePaisa, quantity: 1, imageUrl: item.img ?? undefined, maxPerOrder: item.maxPerOrder, model: item.model, config: item.config, sku: item.sku });
              openCartDrawer();
            }}
            style={{ height: 46, border: 0, borderRadius: 12, background: "var(--lh-action,#2159D4)", color: "#FFFFFF", font: "700 14px var(--font-body)", cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)", transition: "background .18s ease,transform .18s ease" }}
          >
            Add to cart
          </button>
        ) : (
          <button
            type="button"
            className="v5-card-ask"
            onClick={() => setInquiring(true)}
            style={{ height: 46, border: "1px solid var(--lh-border,#DAE5F2)", borderRadius: 12, background: "var(--lh-paper,#FFFFFF)", color: "var(--lh-ink,#102039)", font: "700 14px var(--font-body)", cursor: "pointer", transition: "border-color .18s ease" }}
          >
            Ask about this product
          </button>
        )}
      </div>
      {!purchasable ? <InquiryDialog open={inquiring} onClose={() => setInquiring(false)} productTitle={item.title} productHandle={item.h} /> : null}
    </article>
  );
}

/** Adapter for pages that still pass a `PublicProduct`. */
export function ProductCard({ product }: { product: PublicProduct }) {
  return <V5ProductCard item={v5Card(toV5(product, 0))} />;
}
