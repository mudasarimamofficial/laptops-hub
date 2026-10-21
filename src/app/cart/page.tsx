"use client";

import Link from "next/link";
import { cartSubtotalPaisa, useCart } from "@/lib/commerce/cart-store";
import { formatPkr } from "@/lib/money";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const subtotal = cartSubtotalPaisa(lines);

  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Cart</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">Your cart</h1>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        Browser cart is a convenience cache only. Prices are revalidated on the server at COD checkout.
      </p>

      {lines.length === 0 ? (
        <div className="mt-10 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-8 text-center">
          <p className="text-[var(--lh-ink-2)]">Your cart is empty.</p>
          <Link href="/collections/all" className="lh-btn lh-btn-primary mt-4 inline-flex">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {lines.map((l) => (
            <div
              key={l.variantId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-4"
            >
              <div>
                <p className="font-semibold text-[var(--lh-ink)]">{l.title}</p>
                <p className="text-sm text-[var(--lh-ink-2)]">{formatPkr(l.unitPricePaisa)} each</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={l.quantity}
                  onChange={(e) => update(l.variantId, Number(e.target.value) || 1)}
                  className="w-16 rounded-lg border border-[var(--lh-border)] px-2 py-1"
                  aria-label={`Quantity for ${l.title}`}
                />
                <button type="button" className="text-sm text-[var(--lh-error)]" onClick={() => remove(l.variantId)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--lh-divider)] pt-6">
            <p className="font-[family-name:var(--font-display)] text-xl font-bold">
              Subtotal (estimate) {formatPkr(subtotal)}
            </p>
            <Link href="/checkout" className="lh-btn lh-btn-primary">
              Proceed to COD checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
