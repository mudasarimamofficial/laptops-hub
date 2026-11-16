"use client";

import Link from "next/link";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { useCart, cartSubtotalPaisa } from "@/lib/commerce/cart-store";
import { fmtPkr } from "@/lib/catalog/v5-model";
import { checkoutEnabled, lineView } from "@/components/storefront/cart-lines";

/** Port of the V5 cart page (`isCart`). Totals are a browser estimate; the server reprices at checkout. */
export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const step = { width: 44, height: "100%", border: 0, background: "transparent", fontSize: 18, cursor: "pointer", color: "var(--lh-ink)" } as const;
  const row = { display: "flex", justifyContent: "space-between", fontSize: 15 } as const;

  return (
    <section data-screen-label="Cart" style={{ maxWidth: 1360, margin: "0 auto", padding: "36px clamp(16px,3vw,32px) 80px" }}>
      <h1 style={{ margin: "0 0 28px", fontFamily: "var(--font-display)", fontSize: "clamp(34px,4vw,56px)", lineHeight: 1.04, letterSpacing: "-.04em", fontWeight: 700 }}>Cart</h1>
      {!lines.length ? (
        <div style={{ padding: "72px 24px", textAlign: "center", background: "#FFFFFF", border: "1px solid var(--lh-border)", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Your cart is empty</span>
          <Link href="/collections/all" style={{ height: 48, padding: "0 24px", borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
            Browse the catalog
          </Link>
        </div>
      ) : (
        <div className="v5-cart-cols" style={{ display: "grid", gap: 28, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", background: "#FFFFFF", border: "1px solid var(--lh-border)", borderRadius: 24, overflow: "hidden" }}>
            {lines.map((l) => {
              const v = lineView(l);
              return (
                <div key={l.variantId} style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 18, padding: 20, borderBottom: "1px solid var(--lh-divider)" }}>
                  <Link href={v.href} tabIndex={-1} aria-hidden="true" style={{ position: "relative", aspectRatio: "4/3", borderRadius: 14, background: "radial-gradient(100% 90% at 50% 100%,var(--lh-titanium),#FFFFFF)", overflow: "hidden", display: "block" }}>
                    <LHImg src={l.imageUrl} alt="" pad="8px" blend="multiply" eager />
                  </Link>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <Link href={v.href} style={{ display: "flex", flexDirection: "column", gap: 3, color: "var(--lh-ink)" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>{v.model}</span>
                        <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>{v.config}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-ink-2)", marginTop: 2 }}>{v.sku}</span>
                      </Link>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{fmtPkr(l.unitPricePaisa * l.quantity)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", height: 46, border: "1px solid var(--lh-border)", borderRadius: 999 }}>
                        <button type="button" onClick={() => update(l.variantId, l.quantity - 1)} aria-label="Decrease quantity" style={step}>
                          −
                        </button>
                        <span role="spinbutton" aria-label="Quantity" aria-valuenow={l.quantity} aria-valuemin={1} aria-valuemax={v.max} style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>
                          {l.quantity}
                        </span>
                        <button type="button" onClick={() => update(l.variantId, l.quantity + 1)} aria-label="Increase quantity" style={step}>
                          +
                        </button>
                      </div>
                      <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>{fmtPkr(l.unitPricePaisa)} each</span>
                      <button type="button" onClick={() => remove(l.variantId)} style={{ marginLeft: "auto", border: 0, background: "transparent", fontSize: 13, fontWeight: 700, color: "var(--lh-error)", cursor: "pointer", padding: "8px 0" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24, borderRadius: 24, backgroundColor: "var(--lh-navy)", backgroundImage: "radial-gradient(80% 60% at 100% 0%,rgba(var(--lh-iris-rgb),.3),transparent 70%)", color: "#FFFFFF", position: "sticky", top: 96 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>Summary</span>
            <div style={row}>
              <span style={{ color: "var(--lh-on-dark-2)" }}>Items</span>
              <span>{count}</span>
            </div>
            <div style={row}>
              <span style={{ color: "var(--lh-on-dark-2)" }}>Shipping</span>
              <span style={{ color: "var(--lh-on-dark-2)" }}>Calculated at checkout</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 700, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: "var(--font-display)" }}>{fmtPkr(cartSubtotalPaisa(lines))}</span>
            </div>
            {checkoutEnabled ? (
              <Link href="/checkout" className="v5-hov-bright" style={{ height: 54, borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Checkout
              </Link>
            ) : (
              <button type="button" disabled style={{ height: 54, border: "1px solid rgba(255,255,255,.16)", borderRadius: 999, background: "rgba(255,255,255,.06)", color: "var(--lh-on-dark-2)", fontSize: 16, fontWeight: 700, cursor: "not-allowed" }}>
                Checkout
              </button>
            )}
            <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--lh-on-dark-2)" }}>
              {checkoutEnabled ? "Prices, delivery and the order total are confirmed at checkout." : "Online checkout is not open yet. Your cart is saved on this device."}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
