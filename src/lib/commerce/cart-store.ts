"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "@/types/catalog";
import { clampQty, lineMax } from "@/lib/commerce/cart-limits";
import { showToast } from "@/lib/commerce/toast";

const KEY = "lh-cart-v1";

type CartState = { lines: CartLine[] };

let memory: CartState = { lines: [] };
/** Raw localStorage value behind `memory`; getSnapshot must return a stable reference while it is unchanged. */
let memoryRaw: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(): CartState {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw === memoryRaw) return memory;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    memory = { lines: Array.isArray(parsed.lines) ? parsed.lines : [] };
    memoryRaw = raw;
  } catch {
    /* ignore */
  }
  return memory;
}

function write(next: CartState) {
  memory = next;
  memoryRaw = JSON.stringify(next);
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, memoryRaw);
  }
  emit();
}

export function useCart<T>(selector: (s: CartState & CartActions) => T): T {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => memory,
  );

  const actions: CartActions = {
    add(line) {
      const cur = read();
      const existing = cur.lines.find((l) => l.variantId === line.variantId);
      let lines: CartLine[];
      const max = lineMax(line.maxPerOrder ?? existing?.maxPerOrder);
      // V5 `add`: clamp to the per-order limit and say so.
      if ((existing?.quantity ?? 0) + line.quantity > max) showToast("Maximum quantity reached");
      if (existing) {
        lines = cur.lines.map((l) =>
          l.variantId === line.variantId
            ? { ...l, maxPerOrder: line.maxPerOrder ?? l.maxPerOrder, quantity: clampQty(l.quantity + line.quantity, max) }
            : l,
        );
      } else {
        lines = [...cur.lines, { ...line, quantity: clampQty(line.quantity, lineMax(line.maxPerOrder)) }];
      }
      write({ lines });
    },
    update(variantId, quantity) {
      const line = read().lines.find((l) => l.variantId === variantId);
      if (line && quantity > lineMax(line.maxPerOrder)) showToast("Maximum quantity reached");
      const lines =
        quantity <= 0
          ? read().lines.filter((l) => l.variantId !== variantId)
          : read().lines.map((l) =>
              l.variantId === variantId ? { ...l, quantity: clampQty(quantity, lineMax(l.maxPerOrder)) } : l,
            );
      write({ lines });
    },
    remove(variantId) {
      write({ lines: read().lines.filter((l) => l.variantId !== variantId) });
    },
    clear() {
      write({ lines: [] });
    },
  };

  return selector({ ...state, ...actions });
}

type CartActions = {
  add: (line: CartLine) => void;
  update: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

export function cartSubtotalPaisa(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.unitPricePaisa * l.quantity, 0);
}
