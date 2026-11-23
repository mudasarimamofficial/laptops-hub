"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { InquiryDialog } from "@/components/commerce/inquiry-dialog";
import { VariantPicker, pickerModel, variantLabel } from "@/components/commerce/variant-picker";
import { canPurchase } from "@/lib/catalog/availability";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { setBuyNowLine } from "@/lib/commerce/buy-now-store";
import { useCompare } from "@/lib/commerce/compare-store";
import { showToast } from "@/lib/commerce/toast";
import { fmtPkr } from "@/lib/catalog/v5-model";
import { usePricedUnit } from "@/components/storefront/discount-provider";
import { PriceDisplay } from "@/components/storefront/price-display";
import type { PdpCtaMode } from "@/lib/commerce/store-commerce-settings";
import type { PublicVariant } from "@/types/catalog";

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
          <LHImg
            src={images[i]}
            alt={`${model}${config ? ", " + config : ""}, photo ${i + 1} of ${n}`}
            pad="clamp(16px,3vw,40px)"
            blend="multiply"
            eager
            priority={i === 0}
            displayWidth={640}
            sizes="(max-width: 768px) 92vw, (max-width: 1200px) 48vw, 640px"
          />
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
            <LHImg src={src} alt="" pad="5px" displayWidth={84} sizes="84px" />
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
  optionNames: string[];
  variants: PublicVariant[];
  /** Merchant setting: only the main PDP CTA. Product cards stay Add to cart. */
  pdpCta?: PdpCtaMode;
};

/** V5 PDP purchase panel controls: variant picker, quantity stepper + add to cart / buy now (or inquiry), compare toggle. */
export function ProductBuy(p: BuyProps) {
  // Single-variant listings (and pages built before variants were loaded) behave exactly as before.
  const variants: PublicVariant[] = p.variants?.length
    ? p.variants
    : [{ id: p.variantId, sku: p.sku, title: "Default", optionValues: {}, pricePaisa: p.pricePaisa, compareAtPaisa: null, maxPerOrder: p.maxPerOrder, available: p.available, mediaId: null }];
  const hasOptions = variants.length > 1;
  // The server already chose the default (first available variant by position). The selection is a variant id that
  // must exist in this product's variant list — there is no fallback to another variant.
  const [selectedId, setSelectedId] = useState(p.variantId);
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const [qty, setQty] = useState(1);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingNav, startTransition] = useTransition();
  const router = useRouter();
  const add = useCart((s) => s.add);
  const toggle = useCompare((s) => s.toggle);
  const compared = useCompare((s) => s.handles.includes(p.handle));
  const buyNow = (p.pdpCta ?? "add_to_cart") === "buy_now";

  const max = Math.max(1, selected?.maxPerOrder || 1);
  const q = Math.min(qty, max);
  const purchasable = selected !== null && canPurchase({ available: selected.available, pricePaisa: selected.pricePaisa, variantId: selected.id });
  const soldOut = selected !== null && !selected.available;
  const label = selected && hasOptions ? variantLabel(selected, pickerModel(p.optionNames, variants), variants) : "";
  const step = { width: 48, height: "100%", border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "var(--lh-ink)" } as const;
  const submitting = busy || pendingNav;
  const pricedSelected = usePricedUnit(selected?.pricePaisa ?? 0);

  function buildLine() {
    if (!selected) return null;
    return {
      variantId: selected.id,
      handle: p.handle,
      title: p.title,
      unitPricePaisa: selected.pricePaisa,
      quantity: q,
      imageUrl: p.imageUrl ?? undefined,
      maxPerOrder: selected.maxPerOrder,
      model: p.model,
      config: hasOptions ? label : p.config,
      sku: selected.sku,
    };
  }

  function onPrimaryClick() {
    if (submitting) return;
    const line = buildLine();
    if (!line) return;
    if (buyNow) {
      setBusy(true);
      try {
        setBuyNowLine(line);
        startTransition(() => {
          router.push("/checkout?mode=buy_now");
        });
      } catch {
        setBusy(false);
        showToast("Could not start checkout. Please try again.");
      }
      return;
    }
    add(line);
    openCartDrawer();
  }

  return (
    <>
      {hasOptions ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <span data-testid="pdp-price" aria-live="polite">
              {selected ? <PriceDisplay priced={pricedSelected} size="lg" /> : "Choose an option"}
            </span>
          </div>
          {selected ? (
            <VariantPicker
              optionNames={p.optionNames}
              variants={variants}
              selected={selected}
              onSelect={(v) => {
                setSelectedId(v.id);
                setQty(1);
              }}
            />
          ) : null}
          {selected?.sku ? (
            <p data-testid="pdp-sku" style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" }}>SKU: {selected.sku}</p>
          ) : null}
        </>
      ) : null}
      {purchasable && selected ? (
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
            data-testid="pdp-primary-cta"
            data-variant-id={selected.id}
            data-cta={buyNow ? "buy_now" : "add_to_cart"}
            disabled={submitting}
            aria-busy={submitting}
            onClick={onPrimaryClick}
            style={{ flex: 1, minWidth: 200, height: 54, border: 0, borderRadius: 14, background: "var(--lh-action)", color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.75 : 1, boxShadow: "0 14px 30px -18px rgba(var(--lh-action-rgb),.9)", transition: "background .18s ease,transform .18s ease" }}
          >
            <span>
              {submitting
                ? buyNow
                  ? "Starting checkout…"
                  : "Adding…"
                : buyNow
                  ? `Buy now · ${fmtPkr(pricedSelected.sellingPaisa * q)}`
                  : `Add to cart · ${fmtPkr(pricedSelected.sellingPaisa * q)}`}
            </span>
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {soldOut ? (
            <p data-testid="pdp-sold-out" role="status" style={{ margin: 0, fontWeight: 700, color: "var(--lh-ink)" }}>
              {hasOptions ? "This option is sold out." : "Sold out."}
            </p>
          ) : null}
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
