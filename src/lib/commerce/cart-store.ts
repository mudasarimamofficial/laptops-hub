"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "@/types/catalog";

const KEY = "lh-cart-v1";

type CartState = { lines: CartLine[] };

let memory: CartState = { lines: [] };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(): CartState {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory;
    memory = JSON.parse(raw) as CartState;
  } catch {
    /* ignore */
  }
  return memory;
}

function write(next: CartState) {
  memory = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
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
      if (existing) {
        lines = cur.lines.map((l) =>
          l.variantId === line.variantId
            ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) }
            : l,
        );
      } else {
        lines = [...cur.lines, line];
      }
      write({ lines });
    },
    update(variantId, quantity) {
      const lines =
        quantity <= 0
          ? read().lines.filter((l) => l.variantId !== variantId)
          : read().lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l));
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
