/**
 * Homepage section ORDER and visibility — pure functions shared by the storefront renderer, the staff preview, the
 * theme API and the editor.
 *
 * Rules (structural constraints of the V5 design, enforced everywhere):
 * - The cinematic hero is always first: it sits directly under the header.
 * - The store map is always last: it is rendered after the footer and revealed from under it.
 * - Every other V5 section can be moved and hidden. Each type appears once.
 *
 * Drafts and published snapshots saved before ordering existed stored the registry order, which never matched the
 * page (the page used a fixed composition, plus a "placement" setting for reviews). Those layouts carry no
 * `LAYOUT_MARKER` and are read in the approved V5 order, so publishing an old draft can never reshuffle the page.
 */
import { reviewsSettings } from "./home-sections";
import { V5_HOMEPAGE_SECTIONS, type SectionInstance, type SectionType } from "./site-builder-schema";

/** Approved V5 order (as rendered by the original fixed composition). */
export const V5_DEFAULT_ORDER: SectionType[] = [
  "v5_cinematic_hero",
  "v5_product_story",
  "v5_chromebook",
  "v5_brand_grid",
  "v5_featured_products",
  "v5_promo",
  "v5_spec_filters",
  "v5_new_gen",
  "v5_budget_bands",
  "v5_compare_demo",
  "v5_store_reviews",
  "v5_home_inquiry",
  "v5_store_map",
];

export const FIXED_FIRST: SectionType = "v5_cinematic_hero";
export const FIXED_LAST: SectionType = "v5_store_map";

/** Why a section cannot move (shown in the editor). */
export const FIXED_REASON: Partial<Record<SectionType, string>> = {
  v5_cinematic_hero: "Always first: the hero sits directly under the header.",
  v5_store_map: "Always last: the map is shown after the footer and revealed from under it.",
};

/** Set on the hero section's settings once a layout has been saved by the ordering-aware editor. */
export const LAYOUT_MARKER = "layoutOrder";
export const LAYOUT_MARKER_VALUE = "ordered-v1";

const RENDERABLE = new Set<string>(V5_DEFAULT_ORDER);

/** Sections whose kicker shows a section number (when "show section numbers" is on), in V5 order. */
const NUMBERED: SectionType[] = [
  "v5_cinematic_hero",
  "v5_product_story",
  "v5_chromebook",
  "v5_brand_grid",
  "v5_featured_products",
  "v5_promo",
  "v5_spec_filters",
  "v5_new_gen",
  "v5_budget_bands",
  "v5_compare_demo",
  "v5_home_inquiry",
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const defaultOf = (type: SectionType) => clone(V5_HOMEPAGE_SECTIONS.find((d) => d.type === type)!);

function isShape(s: unknown): s is SectionInstance {
  const o = s as SectionInstance | null;
  return (
    !!o &&
    typeof o === "object" &&
    typeof o.id === "string" &&
    typeof o.type === "string" &&
    typeof o.enabled === "boolean" &&
    !!o.settings &&
    typeof o.settings === "object"
  );
}

export function isOrderedLayout(sections: SectionInstance[]): boolean {
  return sections.some((s) => s.type === FIXED_FIRST && s.settings?.[LAYOUT_MARKER] === LAYOUT_MARKER_VALUE);
}

/** Legacy layouts: V5 order; reviews go where their old "placement" setting put them. */
function legacyRank(s: SectionInstance): number {
  if (s.type === "v5_store_reviews") {
    const where = reviewsSettings(s.settings).placement;
    // after_featured rendered right after the featured laptops (and reels); the other two right after compare.
    return where === "after_featured"
      ? V5_DEFAULT_ORDER.indexOf("v5_featured_products") + 0.5
      : V5_DEFAULT_ORDER.indexOf("v5_compare_demo") + 0.5;
  }
  return V5_DEFAULT_ORDER.indexOf(s.type);
}

/**
 * The layout to render or edit: known V5 sections only, each type once, missing types added at their V5 position
 * (enabled, default settings), hero first, map last, marked as ordered. Never throws; `null` → V5 default.
 */
export function normalizeHomepageLayout(input: readonly unknown[] | null | undefined): SectionInstance[] {
  const seen = new Set<string>();
  let list: SectionInstance[] = (Array.isArray(input) ? input : [])
    .filter(isShape)
    .filter((s) => RENDERABLE.has(s.type) && !seen.has(s.type) && !!seen.add(s.type))
    .map((s) => clone(s));

  if (!isOrderedLayout(list)) list = [...list].sort((a, b) => legacyRank(a) - legacyRank(b));

  // Add any missing section type after the nearest section that precedes it in V5 order.
  for (const type of V5_DEFAULT_ORDER) {
    if (list.some((s) => s.type === type)) continue;
    const before = V5_DEFAULT_ORDER.slice(0, V5_DEFAULT_ORDER.indexOf(type)).reverse();
    const anchor = before.map((t) => list.findIndex((s) => s.type === t)).find((i) => i >= 0);
    list.splice(anchor === undefined ? 0 : anchor + 1, 0, defaultOf(type));
  }

  const hero = list.find((s) => s.type === FIXED_FIRST)!;
  const map = list.find((s) => s.type === FIXED_LAST)!;
  list = [hero, ...list.filter((s) => s !== hero && s !== map), map];
  hero.settings = { ...hero.settings, [LAYOUT_MARKER]: LAYOUT_MARKER_VALUE };
  return list;
}

/** Problems that make a submitted layout invalid (the editor prevents them; the API refuses them). */
export function homepageLayoutProblems(sections: { id: string; type: string }[]): string[] {
  const out: string[] = [];
  const types = sections.map((s) => s.type);
  const ids = sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) out.push("Each section must have a unique id.");
  const dup = types.filter((t, i) => types.indexOf(t) !== i);
  if (dup.length) out.push(`Each section can appear only once (duplicate: ${[...new Set(dup)].join(", ")}).`);
  const unknown = types.filter((t) => !RENDERABLE.has(t));
  if (unknown.length) out.push(`Unsupported section type: ${[...new Set(unknown)].join(", ")}.`);
  if (types.includes(FIXED_FIRST) && types[0] !== FIXED_FIRST) out.push(FIXED_REASON[FIXED_FIRST]!);
  if (types.includes(FIXED_LAST) && types[types.length - 1] !== FIXED_LAST) out.push(FIXED_REASON[FIXED_LAST]!);
  return out;
}

export function canMove(sections: SectionInstance[], index: number, dir: -1 | 1): boolean {
  const s = sections[index];
  const target = index + dir;
  if (!s || target < 0 || target >= sections.length) return false;
  if (s.type === FIXED_FIRST || s.type === FIXED_LAST) return false;
  const other = sections[target];
  return other.type !== FIXED_FIRST && other.type !== FIXED_LAST;
}

/** Swap a section with its neighbour; returns the same array when the move is not allowed. */
export function moveSection(sections: SectionInstance[], index: number, dir: -1 | 1): SectionInstance[] {
  if (!canMove(sections, index, dir)) return sections;
  const next = [...sections];
  [next[index], next[index + dir]] = [next[index + dir], next[index]];
  return next;
}

/**
 * Section numbers ("02 — PRODUCT STORY") follow the layout order. With the V5 order they are exactly the original
 * 01–11; hidden sections keep their number slot, as before.
 */
export function sectionNumbers(sections: SectionInstance[]): Partial<Record<SectionType, string>> {
  const out: Partial<Record<SectionType, string>> = {};
  sections
    .filter((s) => NUMBERED.includes(s.type))
    .forEach((s, i) => {
      out[s.type] = String(i + 1).padStart(2, "0");
    });
  return out;
}
