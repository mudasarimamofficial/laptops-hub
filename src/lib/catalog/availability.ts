import type { PublicProduct } from "@/types/catalog";

/**
 * Client-side purchase eligibility for UI controls only.
 * The server (`create_cod_order`) re-validates status, purchasable flag, price and quantity.
 */
export function canPurchase(p: Pick<PublicProduct, "available" | "pricePaisa" | "variantId">): boolean {
  return p.available === true && Number.isInteger(p.pricePaisa) && p.pricePaisa > 0 && Boolean(p.variantId);
}
