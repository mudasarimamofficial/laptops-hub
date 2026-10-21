"use client";

import { useState } from "react";
import type { CartLine } from "@/types/catalog";
import { useCart } from "@/lib/commerce/cart-store";

export function AddToCartButton({
  line,
  max,
  available = true,
}: {
  line: Omit<CartLine, "quantity"> & { quantity?: number };
  max: number;
  /** When false nothing renders and no line can be added. */
  available?: boolean;
}) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);

  if (!available) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-[var(--lh-ink-2)]">
        Qty
        <input
          type="number"
          min={1}
          max={max}
          value={qty}
          onChange={(e) => setQty(Math.min(max, Math.max(1, Number(e.target.value) || 1)))}
          className="w-16 rounded-lg border border-[var(--lh-border)] px-2 py-1.5"
        />
      </label>
      <button
        type="button"
        className="lh-btn lh-btn-primary"
        onClick={() => {
          if (!available) return;
          add({ ...line, quantity: qty });
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }}
      >
        {done ? "Added" : "Add to cart"}
      </button>
    </div>
  );
}
