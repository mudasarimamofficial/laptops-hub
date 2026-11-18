"use client";

import type { CartLine } from "@/types/catalog";
import { clampQty, lineMax } from "@/lib/commerce/cart-limits";

const KEY = "lh-buynow-v1";

/** Isolated buy-now checkout lines. Does not touch the main cart (`lh-cart-v1`). */
export function setBuyNowLine(line: CartLine): void {
  if (typeof window === "undefined") return;
  const quantity = clampQty(line.quantity, lineMax(line.maxPerOrder));
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ lines: [{ ...line, quantity }], at: Date.now() }));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readBuyNowLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { lines?: CartLine[] };
    return Array.isArray(parsed.lines) ? parsed.lines : [];
  } catch {
    return [];
  }
}

export function clearBuyNowLines(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
