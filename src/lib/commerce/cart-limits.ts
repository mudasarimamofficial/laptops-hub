/** Mirrors DB constraints: product_variants.max_per_order CHECK (1..20), order_items.quantity <= 20. */
export const CART_HARD_MAX = 20;

/** Per-line limit: the variant's max_per_order when known, else the hard cap. The server re-checks. */
export function lineMax(maxPerOrder: number | null | undefined): number {
  const n = Number(maxPerOrder);
  if (!Number.isInteger(n) || n < 1) return CART_HARD_MAX;
  return Math.min(n, CART_HARD_MAX);
}

/** Clamp a requested quantity to 1..max. Non-numeric input becomes 1. */
export function clampQty(q: number, max: number): number {
  const n = Math.floor(Number(q));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}
