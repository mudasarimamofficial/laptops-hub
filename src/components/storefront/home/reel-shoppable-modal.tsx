"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import type { PublicReel, ReelShopProduct } from "@/lib/content/reels";

type Props = {
  reel: PublicReel;
  open: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function ReelShoppableModal({ reel, open, onClose, returnFocusRef }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const add = useCart((s) => s.add);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const focusReturn = returnFocusRef?.current;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      focusReturn?.focus?.();
    };
  }, [open, onClose, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    void el.play().catch(() => undefined);
    return () => {
      el.pause();
    };
  }, [open, reel.id]);

  if (!open || typeof document === "undefined") return null;

  const products = reel.products ?? [];

  return createPortal(
    <div
      role="presentation"
      data-testid="reel-shoppable-modal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: "max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom))",
        background: "rgba(10, 23, 48, 0.62)",
        backdropFilter: "blur(4px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="reel-shoppable-modal"
        style={{
          width: "min(980px, calc(100vw - 24px))",
          maxHeight: "min(92vh, 860px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
          gap: 0,
          background: "#FFFFFF",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 40px 80px -28px rgba(10,23,48,.55)",
          position: "relative",
        }}
        className="lh-reel-modal"
      >
        <button
          ref={closeBtn}
          type="button"
          aria-label="Close video"
          data-testid="reel-modal-close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2,
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "1px solid var(--lh-border)",
            background: "#FFFFFF",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            lineHeight: 1,
            color: "var(--lh-ink)",
          }}
        >
          ×
        </button>

        <div
          style={{
            position: "relative",
            background: "var(--lh-navy)",
            minHeight: 280,
            aspectRatio: "9 / 16",
            maxHeight: "min(92vh, 860px)",
          }}
        >
          <video
            ref={videoRef}
            data-testid="reel-modal-video"
            playsInline
            loop
            controls
            preload="metadata"
            poster={reel.posterUrl || undefined}
            aria-label={reel.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          >
            <source src={reel.videoUrl} />
            {reel.hlsUrl ? <source src={reel.hlsUrl} type="application/x-mpegURL" /> : null}
          </video>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            maxHeight: "min(92vh, 860px)",
            background: "var(--lh-canvas)",
          }}
        >
          <div style={{ padding: "22px 24px 12px", borderBottom: "1px solid var(--lh-border)", background: "#FFF" }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".12em",
                color: "var(--lh-ink-2)",
                textTransform: "uppercase",
              }}
            >
              Shop this video
            </p>
            <h3 id={titleId} style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "-.03em" }}>
              {reel.title}
            </h3>
            {reel.caption ? (
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--lh-ink-2)", lineHeight: 1.5 }}>{reel.caption}</p>
            ) : null}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {products.length === 0 ? (
              <div
                data-testid="reel-modal-empty-products"
                style={{
                  padding: 24,
                  borderRadius: 16,
                  border: "1px dashed var(--lh-border)",
                  background: "#FFF",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: "var(--lh-ink)" }}>No linked laptops yet</p>
                <p style={{ margin: "8px 0 16px", fontSize: 14, color: "var(--lh-ink-2)" }}>
                  Browse the catalog while we add products for this clip.
                </p>
                <Link
                  href={reel.linkPath || "/collections/laptops"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 44,
                    padding: "0 18px",
                    borderRadius: 999,
                    background: "var(--lh-grad-action)",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Browse laptops
                </Link>
              </div>
            ) : (
              products.map((p) => <ShopProductCard key={p.handle} product={p} onAdd={add} onClose={onClose} />)
            )}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 819.98px) {
          .lh-reel-modal {
            grid-template-columns: 1fr !important;
            max-height: min(96vh, 920px) !important;
            width: min(520px, calc(100vw - 20px)) !important;
          }
          .lh-reel-modal > div:first-of-type {
            aspect-ratio: 9 / 14 !important;
            max-height: 42vh !important;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function ShopProductCard({
  product: p,
  onAdd,
  onClose,
}: {
  product: ReelShopProduct;
  onAdd: (line: {
    variantId: string;
    handle: string;
    title: string;
    unitPricePaisa: number;
    quantity: number;
    imageUrl?: string;
    maxPerOrder?: number;
    model?: string;
    config?: string;
    sku?: string | null;
  }) => void;
  onClose: () => void;
}) {
  return (
    <article
      data-testid="reel-shop-product"
      style={{
        display: "grid",
        gridTemplateColumns: "88px minmax(0, 1fr)",
        gap: 14,
        padding: 14,
        borderRadius: 16,
        border: "1px solid var(--lh-border)",
        background: "#FFF",
      }}
    >
      <Link
        href={`/products/${encodeURIComponent(p.handle)}`}
        style={{
          display: "block",
          aspectRatio: "1",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--lh-titanium)",
        }}
      >
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }} />
        ) : null}
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <Link
          href={`/products/${encodeURIComponent(p.handle)}`}
          style={{ fontWeight: 700, fontSize: 15, color: "var(--lh-ink)", textDecoration: "none" }}
        >
          {p.model || p.title}
        </Link>
        {p.config ? <span style={{ fontSize: 13, color: "var(--lh-ink-2)", lineHeight: 1.4 }}>{p.config}</span> : null}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{p.priceText}</span>
          {p.compareAtText ? (
            <span style={{ fontSize: 13, color: "var(--lh-ink-3)", textDecoration: "line-through" }}>{p.compareAtText}</span>
          ) : null}
          <span style={{ fontSize: 12, color: p.available ? "var(--lh-ink-2)" : "var(--lh-danger, #b42318)" }}>
            {p.available ? "In stock" : "Unavailable"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <Link
            href={`/products/${encodeURIComponent(p.handle)}`}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid var(--lh-border)",
              display: "inline-flex",
              alignItems: "center",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--lh-ink)",
              background: "#FFF",
            }}
          >
            View product
          </Link>
          {p.available ? (
            <button
              type="button"
              data-testid="reel-modal-add-to-cart"
              onClick={() => {
                onAdd({
                  variantId: p.variantId,
                  handle: p.handle,
                  title: p.title,
                  unitPricePaisa: p.pricePaisa,
                  quantity: 1,
                  imageUrl: p.imageUrl || undefined,
                  maxPerOrder: p.maxPerOrder,
                  model: p.model,
                  config: p.config,
                  sku: p.sku,
                });
                // Modal sits above the cart drawer (z-index 80 vs 71); close it so the cart is usable.
                onClose();
                openCartDrawer();
              }}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 999,
                border: 0,
                display: "inline-flex",
                alignItems: "center",
                fontWeight: 700,
                fontSize: 13,
                color: "#FFF",
                background: "var(--lh-grad-action)",
                cursor: "pointer",
              }}
            >
              Add to cart
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
