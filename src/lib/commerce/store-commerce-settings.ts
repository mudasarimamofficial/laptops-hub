/**
 * Merchant commerce switches persisted in store_settings.
 * Defaults match the product mandate: inventory tracking OFF, PDP CTA = add to cart.
 */

export const INVENTORY_TRACKING_KEY = "inventory_tracking";
export const STOREFRONT_CHECKOUT_KEY = "storefront_checkout";

export type PdpCtaMode = "add_to_cart" | "buy_now";

export type InventoryTrackingSetting = {
  enabled: boolean;
};

export type StorefrontCheckoutSetting = {
  pdpCta: PdpCtaMode;
};

export function parseInventoryTracking(value: unknown): InventoryTrackingSetting {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const enabled = (value as Record<string, unknown>).enabled;
    if (typeof enabled === "boolean") return { enabled };
    if (enabled === "true") return { enabled: true };
    if (enabled === "false") return { enabled: false };
  }
  return { enabled: false };
}

export function parseStorefrontCheckout(value: unknown): StorefrontCheckoutSetting {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = (value as Record<string, unknown>).pdp_cta;
    if (raw === "buy_now" || raw === "add_to_cart") return { pdpCta: raw };
  }
  return { pdpCta: "add_to_cart" };
}
