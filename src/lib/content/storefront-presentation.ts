/**
 * Shopper-facing presentation switches (store_settings key `storefront_presentation`).
 *
 * The client asked (Nov 2026) to stop showing catalog counts ("226 listings", "View all 170", "226 products in the
 * catalog"), technical story labels ("Front view · 1/4") and numbered section labels ("02 — PRODUCT STORY") on the
 * storefront. This is presentation only: products, categories and alt text are unchanged. Defaults follow the
 * client's request (all hidden); the merchant can turn each back on in Admin → Settings → Storefront labels.
 */
export type StorefrontPresentation = {
  /** Catalog/category counts in hero stats, brand chips, "View all N", mega menu, footer. */
  showCatalogCounts: boolean;
  /** Product-story angle label and counter, e.g. "Front view · 1/4" (image alt text is always kept). */
  showStoryAngleLabels: boolean;
  /** Numeric prefixes on homepage section labels, e.g. "02 — " in "02 — PRODUCT STORY". */
  showSectionNumbers: boolean;
};

export const STOREFRONT_PRESENTATION_KEY = "storefront_presentation";

export const DEFAULT_STOREFRONT_PRESENTATION: StorefrontPresentation = {
  showCatalogCounts: false,
  showStoryAngleLabels: false,
  showSectionNumbers: false,
};

/** Tolerant parse: only real booleans override defaults (a malformed row can never re-enable a label). */
export function parseStorefrontPresentation(value: unknown): StorefrontPresentation {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const pick = (k: keyof StorefrontPresentation) => (typeof v[k] === "boolean" ? (v[k] as boolean) : DEFAULT_STOREFRONT_PRESENTATION[k]);
  return {
    showCatalogCounts: pick("showCatalogCounts"),
    showStoryAngleLabels: pick("showStoryAngleLabels"),
    showSectionNumbers: pick("showSectionNumbers"),
  };
}

/** "02 — PRODUCT STORY" → "PRODUCT STORY" unless section numbers are enabled. */
export function sectionLabel(num: string, text: string, p: Pick<StorefrontPresentation, "showSectionNumbers">): string {
  return p.showSectionNumbers ? `${num} — ${text}` : text;
}
