import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import {
  INVENTORY_TRACKING_KEY,
  STOREFRONT_CHECKOUT_KEY,
  parseInventoryTracking,
  parseStorefrontCheckout,
  type InventoryTrackingSetting,
  type StorefrontCheckoutSetting,
} from "@/lib/commerce/store-commerce-settings";

/** Per-request dedupe for storefront commerce switches (service role: store_settings is not anon-readable). */
export const getStorefrontCheckoutSetting = cache(async (): Promise<StorefrontCheckoutSetting> => {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("store_settings").select("value").eq("key", STOREFRONT_CHECKOUT_KEY).maybeSingle();
    return parseStorefrontCheckout(data?.value);
  } catch {
    return { pdpCta: "add_to_cart" };
  }
});

export const getInventoryTrackingSetting = cache(async (): Promise<InventoryTrackingSetting> => {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("store_settings").select("value").eq("key", INVENTORY_TRACKING_KEY).maybeSingle();
    return parseInventoryTracking(data?.value);
  } catch {
    return { enabled: false };
  }
});
