/**
 * G11: the storefront files products by exact category and brand names (`CAT` and the brand collections in
 * `v5-model.ts`). Admin forms offer these names, and saves fix the letter case of a known name, so "dell" or "macbook"
 * no longer silently miss the Dell collection or fall back to "Laptop". Unknown values are kept as typed (never invented
 * or dropped). Client-safe: no server imports.
 */
export const CATEGORY_OPTIONS = ["Laptop", "Gaming laptop", "Chromebook", "MacBook", "Tablet", "Accessory"] as const;

/** Brands with their own storefront collection (`/collections/dell` …). Other brands are fine; they just have none. */
export const COLLECTION_BRANDS = ["Dell", "HP", "Lenovo", "Apple", "Microsoft", "ASUS", "Acer", "Toshiba"] as const;

function canonical(list: readonly string[], value: string | null | undefined): string | null {
  const t = (value ?? "").trim().replace(/\s+/g, " ");
  if (!t) return null;
  return list.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
}

export const canonicalCategory = (value: string | null | undefined) => canonical(CATEGORY_OPTIONS, value);
export const canonicalBrand = (value: string | null | undefined) => canonical(COLLECTION_BRANDS, value);
export const isKnownCategory = (value: string | null | undefined) =>
  !!value && (CATEGORY_OPTIONS as readonly string[]).includes(value);
