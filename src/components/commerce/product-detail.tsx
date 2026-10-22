"use client";

import { useRef, useState } from "react";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { InquiryDialog } from "@/components/commerce/inquiry-dialog";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { useCompare } from "@/lib/commerce/compare-store";
import { showToast } from "@/lib/commerce/toast";
import { canPurchase } from "@/lib/catalog/availability";
import { fmtPkr } from "@/lib/catalog/v5-model";

const arrow = { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: "1px solid var(--lh-border)", background: "rgba(255,255,255,.92)", boxShadow: "0 8px 20px -12px rgba(var(--lh-navy-rgb),.6)", cursor: "pointer", display: "grid", placeItems: "center" } as const;

/** V5 PDP gallery: framed main image, prev/next, counter, swipe, thumbnail strip. */
export function ProductGallery({ images, model, config }: { images: string[]; model: string; config: string }) {
  const [gi, setGi] = useState(0);
  const tx = useRef(0);
  const n = images.length;
  const i = n ? ((gi % n) + n) % n : 0;
  return (
    <>
      <div style={{ padding: 1.5, borderRadius: 28, background: "var(--lh-border)" }}>
        <div
          onTouchStart={(e) => (tx.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - tx.current;
            if (Math.abs(dx) > 40) setGi(i + (dx < 0 ? 1 : -1));
          }}
          style={{ position: "relative", aspectRatio: "5/4", borderRadius: 27, overflow: "hidden", background: "radial-gradient(110% 90% at 50% 105%,var(--lh-titanium) 0%,var(--lh-canvas) 50%,#FFFFFF 100%)" }}
        >
          <LHImg src={images[i]} alt={`${model}${config ? ", " + config : ""}, photo ${i + 1} of ${n}`} pad="clamp(16px,3vw,40px)" blend="multiply" eager />
          {n > 1 ? (
            <>
              <button type="button" onClick={() => setGi(i - 1)} aria-label="Previous image" style={{ ...arrow, left: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button type="button" onClick={() => setGi(i + 1)} aria-label="Next image" style={{ ...arrow, right: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <span style={{ position: "absolute", right: 16, bottom: 14, fontFamily: "var(--font-mono)", fontSize: 12, padding: "5px 10px", borderRadius: 999, background: "rgba(var(--lh-navy-rgb),.8)", color: "#FFFFFF" }}>
                {i + 1} / {n}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 2px 6px" }}>
        {images.map((src, k) => (
          <button
            key={src}
            type="button"
            onClick={() => setGi(k)}
            aria-label={`Show image ${k + 1}`}
            aria-current={k === i}
            style={{ flex: "0 0 84px", height: 66, padding: 0, borderRadius: 14, border: k === i ? "2px solid var(--lh-action)" : "1px solid var(--lh-border)", boxShadow: k === i ? "0 0 0 3px rgba(var(--lh-electric-rgb),.25)" : "none", background: "#FFFFFF", cursor: "pointer", position: "relative", overflow: "hidden", transition: "box-shadow .2s ease" }}
          >
            <LHImg src={src} alt="" pad="5px" />
          </button>
        ))}
      </div>
    </>
  );
}

export type BuyProps = {
  handle: string;
  title: string;
  model: string;
  config: string;
  sku: string | null;
  variantId: string;
  pricePaisa: number;
  maxPerOrder: number;
  available: boolean;
  imageUrl: string | null;
};

/** V5 PDP purchase panel controls: quantity stepper + add to cart (or inquiry), compare toggle. */
export function ProductBuy(p: BuyProps) {
  const [qty, setQty] = useState(1);
  const [asking, setAsking] = useState(false);
  const add = useCart((s) => s.add);
  const toggle = useCompare((s) => s.toggle);
  const compared = useCompare((s) => s.handles.includes(p.handle));
  const max = Math.max(1, p.maxPerOrder || 1);
  const q = Math.min(qty, max);
  const purchasable = canPurchase({ available: p.available, pricePaisa: p.pricePaisa, variantId: p.variantId });
  const step = { width: 48, height: "100%", border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "var(--lh-ink)" } as const;

  return (
    <>
      {purchasable ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", height: 54, border: "1px solid var(--lh-border)", borderRadius: 999, background: "#FFFFFF" }}>
            <button type="button" onClick={() => setQty(Math.max(1, q - 1))} aria-label="Decrease quantity" style={step}>
              −
            </button>
            <span aria-live="polite" style={{ minWidth: 28, textAlign: "center", fontWeight: 700 }}>
              {q}
            </span>
            <button type="button" onClick={() => (q >= max ? showToast("Maximum quantity reached") : setQty(q + 1))} aria-label="Increase quantity" style={step}>
              +
            </button>
          </div>
          <button
            type="button"
            className="v5-card-atc"
            onClick={() => {
              add({ variantId: p.variantId, handle: p.handle, title: p.title, unitPricePaisa: p.pricePaisa, quantity: q, imageUrl: p.imageUrl ?? undefined, maxPerOrder: p.maxPerOrder, model: p.model, config: p.config, sku: p.sku });
              openCartDrawer();
            }}
            style={{ flex: 1, minWidth: 200, height: 54, border: 0, borderRadius: 14, background: "var(--lh-action)", color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 14px 30px -18px rgba(var(--lh-action-rgb),.9)", transition: "background .18s ease,transform .18s ease" }}
          >
            <span>Add to cart · {fmtPkr(p.pricePaisa * q)}</span>
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={() => setAsking(true)} style={{ height: 54, border: 0, borderRadius: 14, background: "var(--lh-navy)", color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Ask about this product
          </button>
          <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>Tell us what you need and we’ll reply directly.</span>
          <InquiryDialog open={asking} onClose={() => setAsking(false)} productTitle={p.title} productHandle={p.handle} />
        </div>
      )}
      <button
        type="button"
        onClick={() => toggle(p.handle)}
        aria-pressed={compared}
        style={{ height: 48, border: `1px solid ${compared ? "var(--lh-action)" : "var(--lh-border)"}`, borderRadius: 999, background: compared ? "var(--lh-ice)" : "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", color: compared ? "var(--lh-action-hover)" : "var(--lh-ink)", transition: "all .18s ease" }}
      >
        {compared ? "✓ Added to compare" : "+ Add to compare"}
      </button>
    </>
  );
}
