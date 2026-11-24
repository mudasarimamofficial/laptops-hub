import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Product status is the storefront/checkout visibility gate (public_catalog_listing and create_cod_order both require
 * `status = 'active'`); `product_variants.purchasable` is the per-variant Sell switch. They used to be coupled: a
 * product created as a draft got `purchasable = false` on its variant, so setting it active later (list, bulk or edit)
 * left it with nothing to sell and it never appeared in the store (audit G06/G07).
 *
 * When a product becomes active and NONE of its variants is sellable, that "all off" state comes from draft creation,
 * not from the merchant: switch on every variant that has a price. A product with at least one sellable variant keeps
 * the merchant's per-variant choices untouched.
 */
export async function makeSellableOnActivate(supabase: SupabaseClient, productId: string): Promise<number> {
  const { data, error } = await supabase.from("product_variants").select("id, price_paisa, purchasable").eq("product_id", productId);
  if (error || !data?.length || data.some((v) => v.purchasable)) return 0;
  const ids = data.filter((v) => Number(v.price_paisa) > 0).map((v) => v.id as string);
  if (!ids.length) return 0;
  const { error: uErr } = await supabase.from("product_variants").update({ purchasable: true }).in("id", ids);
  return uErr ? 0 : ids.length;
}

/** Sell switch after a price change: a price of 0 can never be sold; a first real price makes the variant sellable. */
export function purchasableAfterPrice(oldPricePaisa: number, newPricePaisa: number, currentPurchasable: boolean): boolean {
  if (newPricePaisa <= 0) return false;
  if (oldPricePaisa <= 0) return true;
  return currentPurchasable;
}
