import type { CartLine } from "@/types/catalog";
import { lineMax } from "@/lib/commerce/cart-limits";

/** Display fields for a cart line; older persisted lines fall back to the title split V5 uses for `model`. */
export function lineView(l: CartLine) {
  const parts = l.title.split(/ [-—] /);
  return {
    href: "/products/" + encodeURIComponent(l.handle),
    model: l.model || parts[0],
    config: l.config ?? parts.slice(1).join(" - "),
    sku: l.sku ?? null,
    max: lineMax(l.maxPerOrder),
  };
}

export const checkoutEnabled = process.env.NEXT_PUBLIC_COD_CHECKOUT_ENABLED === "true";
