/**
 * Default “🔥 Featured” editorial badge preset.
 *
 * - Editorial only — never invents Top Seller / Best Seller / Trending claims.
 * - Idempotent: store_settings key records install; redeploy does not recreate or overwrite merchant edits.
 * - Merchant removals are recorded in `suppressedProductIds` and never auto-restored.
 */

import { HOMEPAGE_DEFAULT_HANDLES } from "@/lib/content/homepage-image-presets";

export const FEATURED_FLAME_PRESET_KEY = "featured_flame_preset";
/** Stored on product_badges.note so preset rows are identifiable. */
export const FEATURED_FLAME_PRESET_NOTE = "preset:featured_flame_v1";
export const FEATURED_FLAME_PRESET_VERSION = 1;
export const FEATURED_FLAME_TARGET = 6;

export type FeaturedFlamePreset = {
  version: number;
  enabled: boolean;
  /** ISO install time; null until first successful install. */
  installedAt: string | null;
  /** Product UUIDs that received the preset seed (for disable/clear). */
  productIds: string[];
  /** Merchant removed these — never auto-seed again unless restore clears suppression. */
  suppressedProductIds: string[];
  /** Display label for the Featured flame chip (editorial, not a sales claim). */
  label: string;
  /** Visual icon key; storefront maps `flame` to the premium fire glyph. */
  icon: "flame" | "star";
};

export const DEFAULT_FEATURED_FLAME_PRESET: FeaturedFlamePreset = {
  version: FEATURED_FLAME_PRESET_VERSION,
  enabled: true,
  installedAt: null,
  productIds: [],
  suppressedProductIds: [],
  label: "Featured",
  icon: "flame",
};

export function parseFeaturedFlamePreset(value: unknown): FeaturedFlamePreset {
  if (!value || typeof value !== "object") return { ...DEFAULT_FEATURED_FLAME_PRESET };
  const v = value as Record<string, unknown>;
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && /^[0-9a-f-]{36}$/i.test(i)) : []);
  const label = typeof v.label === "string" && v.label.trim() ? v.label.trim().slice(0, 40) : DEFAULT_FEATURED_FLAME_PRESET.label;
  const icon = v.icon === "star" ? "star" : "flame";
  return {
    version: FEATURED_FLAME_PRESET_VERSION,
    enabled: v.enabled !== false,
    installedAt: typeof v.installedAt === "string" ? v.installedAt : null,
    productIds: ids(v.productIds),
    suppressedProductIds: ids(v.suppressedProductIds),
    label,
    icon,
  };
}

const LAPTOP_CATEGORIES = new Set(["laptop", "gaming laptop", "macbook", "chromebook"]);

export type PresetCandidate = {
  id: string;
  handle: string;
  featured: boolean;
  sellable: boolean;
  updatedAt: string | null;
  /** Product category; accessories/tablets are excluded from default Featured. */
  category?: string | null;
};

export function isLaptopCategory(category: string | null | undefined): boolean {
  return LAPTOP_CATEGORIES.has((category || "").trim().toLowerCase());
}

/**
 * Selection priority (editorial Featured — not sales):
 * 1) active featured + sellable laptops
 * 2) homepage-approved presentation handles that are active + sellable
 * 3) remaining active sellable laptops by updated_at (deterministic)
 */
export function selectFeaturedFlameCandidates(rows: PresetCandidate[], target = FEATURED_FLAME_TARGET): PresetCandidate[] {
  const sellable = rows.filter((r) => r.sellable && isLaptopCategory(r.category));
  const out: PresetCandidate[] = [];
  const seen = new Set<string>();
  const take = (list: PresetCandidate[]) => {
    for (const r of list) {
      if (out.length >= target) break;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };

  take(sellable.filter((r) => r.featured).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))));

  const homepage = new Set<string>(Object.values(HOMEPAGE_DEFAULT_HANDLES));
  take(sellable.filter((r) => homepage.has(r.handle)));

  take(
    sellable
      .slice()
      .sort((a, b) => Number(b.featured) - Number(a.featured) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))),
  );

  return out;
}

export function isPresetBadgeNote(note: string | null | undefined): boolean {
  return (note || "").trim() === FEATURED_FLAME_PRESET_NOTE;
}
