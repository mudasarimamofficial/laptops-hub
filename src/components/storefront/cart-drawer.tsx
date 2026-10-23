"use client";

import { useRef } from "react";
import Link from "next/link";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { useDialog } from "@/components/storefront/v5/use-dialog";
import { useCart, cartSubtotalPaisa } from "@/lib/commerce/cart-store";
import { closeCartDrawer, useCartUi } from "@/lib/commerce/cart-ui";
import { fmtPkr } from "@/lib/catalog/v5-model";
import { checkoutEnabled, lineView } from "@/components/storefront/cart-lines";

/** V5 slide-out cart (`drawer`). */
export function CartDrawer() {
  const open = useCartUi((s) => s.open);
  if (!open) return null;
  return <Drawer />;
}

function Drawer() {
  const ref = useRef<HTMLElement>(null);
  const lines = useCart((s) => s.lines);
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  useDialog(true, ref, closeCartDrawer);
  const step = { width: 44, height: "100%", border: 0, background: "transparent", fontSize: 17, cursor: "pointer", color: "var(--lh-ink)" } as const;

  return (
    <>
      <div onClick={closeCartDrawer} style={{ position: "fixed", inset: 0, background: "rgba(var(--lh-navy-rgb),.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 70 }} />
      <aside ref={ref} data-lh-dialog="1" role="dialog" aria-modal="true" aria-label="Cart" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px,100vw)", background: "#FFFFFF", zIndex: 71, display: "flex", flexDirection: "column", boxShadow: "-24px 0 60px -20px rgba(0,0,0,.45)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", background: "var(--lh-canvas)", borderBottom: "1px solid var(--lh-border)", color: "var(--lh-ink)" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>
            Cart <span style={{ color: "var(--lh-action)" }}>({count})</span>
          </span>
          <button type="button" onClick={closeCartDrawer} aria-label="Close cart" style={{ width: 44, height: 44, marginRight: -10, border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {!lines.length ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>Your cart is empty</span>
            <Link href="/collections/all" onClick={closeCartDrawer} style={{ height: 46, padding: "0 22px", borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              Browse the catalog
            </Link>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflow: "auto" }}>
              {lines.map((l) => {
                const v = lineView(l);
                return (
                  <div key={l.variantId} style={{ display: "grid", gridTemplateColumns: "88px minmax(0,1fr)", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--lh-divider)" }}>
                    <Link href={v.href} onClick={closeCartDrawer} tabIndex={-1} aria-hidden="true" style={{ position: "relative", aspectRatio: "4/3", borderRadius: 12, background: "radial-gradient(100% 90% at 50% 100%,var(--lh-titanium),#FFFFFF)", overflow: "hidden", display: "block" }}>
                      <LHImg src={l.imageUrl} alt="" pad="5px" blend="multiply" eager />
                    </Link>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                      <Link href={v.href} onClick={closeCartDrawer} style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--lh-ink)" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{v.model}</span>
                        <span style={{ fontSize: 12, color: "var(--lh-ink-2)" }}>{v.config}</span>
                      </Link>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", height: 46, border: "1px solid var(--lh-border)", borderRadius: 999 }}>
                          <button type="button" onClick={() => update(l.variantId, l.quantity - 1)} aria-label="Decrease quantity" style={step}>
                            −
                          </button>
                          <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{l.quantity}</span>
                          <button type="button" onClick={() => update(l.variantId, l.quantity + 1)} aria-label="Increase quantity" style={step}>
                            +
                          </button>
                        </div>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>{fmtPkr(l.unitPricePaisa * l.quantity)}</span>
                      </div>
                      <button type="button" onClick={() => remove(l.variantId)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", fontSize: 12, fontWeight: 700, color: "var(--lh-error)", cursor: "pointer", padding: "4px 0" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "18px 20px 22px", borderTop: "1px solid var(--lh-border)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}>
                <span>Subtotal</span>
                <span style={{ fontFamily: "var(--font-display)" }}>{fmtPkr(cartSubtotalPaisa(lines))}</span>
              </div>
              <Link href="/cart" onClick={closeCartDrawer} className="v5-hov-bright-10" style={{ height: 52, borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 28px -12px rgba(var(--lh-action-rgb),.9)" }}>
                View cart
              </Link>
              <span style={{ fontSize: 12, color: "var(--lh-ink-2)", textAlign: "center" }}>{checkoutEnabled ? "Prices are confirmed at checkout" : "Online checkout is not open yet"}</span>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
