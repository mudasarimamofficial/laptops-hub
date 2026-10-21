"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPkr } from "@/lib/money";
import { useCart, cartSubtotalPaisa } from "@/lib/commerce/cart-store";
import { closeCartDrawer, useCartUi } from "@/lib/commerce/cart-ui";

export function CartDrawer() {
  const open = useCartUi((s) => s.open);
  const lines = useCart((s) => s.lines);
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cartSubtotalPaisa(lines);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCartDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-[rgba(10,23,48,.55)] backdrop-blur-[4px]"
        onClick={closeCartDrawer}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className="fixed bottom-0 right-0 top-0 z-[71] flex w-[min(440px,100vw)] flex-col bg-white shadow-[-24px_0_60px_-20px_rgba(0,0,0,.45)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--lh-border)] bg-[var(--lh-canvas)] px-5 py-[18px] text-[var(--lh-ink)]">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold">
            Cart <span className="text-[var(--lh-action)]">({count})</span>
          </span>
          <button
            type="button"
            aria-label="Close cart"
            className="-mr-2.5 grid h-11 w-11 place-items-center"
            onClick={closeCartDrawer}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-6 text-center">
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold">Your cart is empty</span>
            <Link
              href="/collections/all"
              onClick={closeCartDrawer}
              className="inline-flex h-[46px] items-center rounded-full bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-[22px] font-bold text-white"
            >
              Browse the catalog
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              {lines.map((l) => (
                <div
                  key={l.variantId}
                  className="grid grid-cols-[88px_minmax(0,1fr)] gap-3.5 border-b border-[var(--lh-divider)] px-5 py-4"
                >
                  <Link
                    href={`/products/${l.handle}`}
                    tabIndex={-1}
                    aria-hidden
                    className="relative block aspect-[4/3] overflow-hidden rounded-xl"
                    style={{ background: "radial-gradient(100% 90% at 50% 100%, var(--lh-titanium), #FFFFFF)" }}
                    onClick={closeCartDrawer}
                  >
                    {l.imageUrl ? (
                      <Image src={l.imageUrl} alt="" fill className="object-contain p-1 mix-blend-multiply" sizes="88px" unoptimized />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Link
                      href={`/products/${l.handle}`}
                      className="flex flex-col gap-0.5 text-[var(--lh-ink)]"
                      onClick={closeCartDrawer}
                    >
                      <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold">{l.title}</span>
                    </Link>
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex h-[46px] items-center rounded-full border border-[var(--lh-border)]">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className="h-full w-11 text-[17px]"
                          onClick={() => update(l.variantId, l.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center text-sm font-bold">{l.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="h-full w-11 text-[17px]"
                          onClick={() => update(l.variantId, Math.min(20, l.quantity + 1))}
                        >
                          +
                        </button>
                      </div>
                      <span className="font-[family-name:var(--font-display)] text-[15px] font-bold">
                        {formatPkr(l.unitPricePaisa * l.quantity)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="self-start py-1 text-xs font-bold text-[var(--lh-error)]"
                      onClick={() => remove(l.variantId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--lh-border)] px-5 pb-[22px] pt-[18px]">
              <div className="flex justify-between text-lg font-bold">
                <span>Subtotal</span>
                <span className="font-[family-name:var(--font-display)]">{formatPkr(subtotal)}</span>
              </div>
              <Link
                href="/cart"
                onClick={closeCartDrawer}
                className="flex h-[52px] items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] text-[15px] font-bold text-white shadow-[0_12px_28px_-12px_rgba(33,89,212,.9)]"
              >
                View cart
              </Link>
              <Link
                href="/checkout"
                onClick={closeCartDrawer}
                className="text-center text-xs text-[var(--lh-ink-2)] underline-offset-2 hover:underline"
              >
                Proceed to checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
