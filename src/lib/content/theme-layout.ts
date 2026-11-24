/**
 * Theme layout controls for non-homepage templates (Phase 2c).
 *
 * Stored in `theme_versions.theme_settings.layout` of the homepage theme, next to `globals`, so it shares the editor's
 * draft → preview → publish → restore flow and its version history. Every value is normalised on read: unknown or
 * corrupt input falls back to the approved V5 layout, so a bad stored value can never break a product page.
 *
 * Business-critical blocks are deliberately NOT configurable: gallery, title, price, variant picker and buy box
 * always render (and keep their order). Only the presentation around them can be changed.
 */

export const PRODUCT_SECTION_IDS = ["details", "reviews", "related"] as const;
export type ProductSectionId = (typeof PRODUCT_SECTION_IDS)[number];

export const PRODUCT_SECTION_LABELS: Record<ProductSectionId, { title: string; note: string }> = {
  details: {
    title: "Specifications & about",
    note: "Dark band with the full spec table and the product description.",
  },
  reviews: {
    title: "Customer reviews",
    note: "Approved product reviews and the review form. Hidden also removes star ratings from search results data.",
  },
  related: {
    title: "Related products",
    note: "Similar listings from the same category.",
  },
};

/** Allowed related-product counts: whole rows of the V5 card grid. */
export const RELATED_COUNTS = [4, 8] as const;

export type ProductLayout = {
  sections: { id: ProductSectionId; visible: boolean }[];
  /** Key-spec tiles above the buy box. */
  showKeySpecs: boolean;
  /** Delivery / returns / warranty tiles under the buy box (only approved public policies ever show). */
  showPolicies: boolean;
  relatedCount: (typeof RELATED_COUNTS)[number];
};

export type ThemeLayout = { product: ProductLayout };

export const DEFAULT_PRODUCT_LAYOUT: ProductLayout = {
  sections: PRODUCT_SECTION_IDS.map((id) => ({ id, visible: true })),
  showKeySpecs: true,
  showPolicies: true,
  relatedCount: 4,
};

export const DEFAULT_THEME_LAYOUT: ThemeLayout = {
  product: DEFAULT_PRODUCT_LAYOUT,
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isSectionId = (v: unknown): v is ProductSectionId => typeof v === "string" && (PRODUCT_SECTION_IDS as readonly string[]).includes(v);

/** Raw stored layout (`theme_settings.layout`), or {} when absent/malformed. */
export function layoutFromThemeSettings(themeSettings: unknown): Record<string, unknown> {
  if (!isObj(themeSettings)) return {};
  return isObj(themeSettings.layout) ? themeSettings.layout : {};
}

/** Effective product layout: stored order first (each id once), then any missing sections in default order. */
export function productLayout(raw: unknown): ProductLayout {
  const r = isObj(raw) ? raw : {};
  const seen = new Set<ProductSectionId>();
  const sections: ProductLayout["sections"] = [];
  if (Array.isArray(r.sections)) {
    for (const s of r.sections) {
      if (!isObj(s) || !isSectionId(s.id) || seen.has(s.id)) continue;
      seen.add(s.id);
      sections.push({ id: s.id, visible: s.visible !== false });
    }
  }
  for (const id of PRODUCT_SECTION_IDS) if (!seen.has(id)) sections.push({ id, visible: true });
  const count = RELATED_COUNTS.find((n) => n === r.relatedCount) ?? DEFAULT_PRODUCT_LAYOUT.relatedCount;
  return {
    sections,
    showKeySpecs: r.showKeySpecs !== false,
    showPolicies: r.showPolicies !== false,
    relatedCount: count,
  };
}

export function themeLayout(raw?: Record<string, unknown> | null): ThemeLayout {
  return { product: productLayout(raw?.product) };
}

export const isProductSectionVisible = (l: ProductLayout, id: ProductSectionId) => l.sections.find((s) => s.id === id)?.visible !== false;

/** Validation for the draft API: messages for values the editor would never send (tampered or stale clients). */
export function themeLayoutProblems(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!isObj(raw)) return ["Layout settings must be an object."];
  const out: string[] = [];
  const p = raw.product;
  if (p === undefined) return out;
  if (!isObj(p)) return ["Product page layout must be an object."];
  if (p.sections !== undefined) {
    if (!Array.isArray(p.sections)) out.push("Product page sections must be a list.");
    else {
      const ids = new Set<string>();
      for (const s of p.sections) {
        if (!isObj(s) || !isSectionId(s.id)) out.push("Unknown product page section.");
        else if (ids.has(s.id)) out.push(`Product page section "${PRODUCT_SECTION_LABELS[s.id].title}" is listed twice.`);
        else ids.add(s.id);
        if (isObj(s) && s.visible !== undefined && typeof s.visible !== "boolean") out.push("Section visibility must be on or off.");
      }
    }
  }
  for (const k of ["showKeySpecs", "showPolicies"] as const) {
    if (p[k] !== undefined && typeof p[k] !== "boolean") out.push("Product page switches must be on or off.");
  }
  if (p.relatedCount !== undefined && !RELATED_COUNTS.some((n) => n === p.relatedCount)) {
    out.push(`Related products must show ${RELATED_COUNTS.join(" or ")} items.`);
  }
  return out;
}

const sameAsDefault = (l: ProductLayout) => JSON.stringify(l) === JSON.stringify(DEFAULT_PRODUCT_LAYOUT);

/** What the draft API stores: normalised values, omitting templates still on the V5 default ({} = all default). */
export function cleanLayoutForSave(raw: unknown): Record<string, unknown> {
  const l = themeLayout(isObj(raw) ? raw : {});
  return sameAsDefault(l.product) ? {} : { product: l.product };
}
