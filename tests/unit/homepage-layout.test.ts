import assert from "node:assert/strict";
import {
  FIXED_FIRST,
  FIXED_LAST,
  LAYOUT_MARKER,
  V5_DEFAULT_ORDER,
  canMove,
  homepageLayoutProblems,
  isOrderedLayout,
  moveSection,
  normalizeHomepageLayout,
  sectionNumbers,
} from "../../src/lib/content/homepage-layout";
import { V5_HOMEPAGE_SECTIONS, type SectionInstance } from "../../src/lib/content/site-builder-schema";

const types = (l: SectionInstance[]) => l.map((s) => s.type);
const sec = (type: string, settings: Record<string, unknown> = {}, enabled = true) =>
  ({ id: type, type, enabled, label: type, settings }) as SectionInstance;

// Default: null and the registry give the approved V5 order, hero first, map last.
assert.deepEqual(types(normalizeHomepageLayout(null)), V5_DEFAULT_ORDER);
assert.deepEqual(types(V5_HOMEPAGE_SECTIONS), V5_DEFAULT_ORDER, "registry is in V5 order");
assert.deepEqual(types(normalizeHomepageLayout(V5_HOMEPAGE_SECTIONS)), V5_DEFAULT_ORDER);
assert.ok(isOrderedLayout(normalizeHomepageLayout(null)));
assert.equal(V5_HOMEPAGE_SECTIONS[0].settings[LAYOUT_MARKER], undefined, "registry defaults are not mutated");

// Legacy drafts (registry order before ordering existed, no marker) render in the V5 order.
const legacyOrder = [
  "v5_cinematic_hero", "v5_product_story", "v5_featured_products", "v5_brand_grid", "v5_budget_bands",
  "v5_spec_filters", "v5_new_gen", "v5_chromebook", "v5_compare_demo", "v5_promo", "v5_home_inquiry",
];
assert.deepEqual(types(normalizeHomepageLayout(legacyOrder.map((t) => sec(t)))), V5_DEFAULT_ORDER, "legacy → V5 order, new sections inserted in place");
const legacyWithReviews = [...legacyOrder.map((t) => sec(t)), sec("v5_store_reviews", { placement: "after_featured" }), sec("v5_store_map")];
const lr = types(normalizeHomepageLayout(legacyWithReviews));
assert.equal(lr.indexOf("v5_store_reviews"), lr.indexOf("v5_featured_products") + 1, "legacy placement after_featured honoured");
const lr2 = types(normalizeHomepageLayout([...legacyOrder.map((t) => sec(t)), sec("v5_store_reviews", { placement: "after_compare" })]));
assert.equal(lr2.indexOf("v5_store_reviews"), lr2.indexOf("v5_compare_demo") + 1);

// Ordered layouts keep their order; hidden stays hidden; settings kept.
const base = normalizeHomepageLayout(null);
const moved = moveSection(base, base.findIndex((s) => s.type === "v5_promo"), -1);
const again = normalizeHomepageLayout(moved);
assert.deepEqual(types(again), types(moved), "ordered layout preserved");
const hidden = again.map((s) => (s.type === "v5_brand_grid" ? { ...s, enabled: false } : s));
assert.equal(normalizeHomepageLayout(hidden).find((s) => s.type === "v5_brand_grid")!.enabled, false);
assert.equal(JSON.stringify(normalizeHomepageLayout(normalizeHomepageLayout(hidden))), JSON.stringify(normalizeHomepageLayout(hidden)), "idempotent");

// Structural constraints: hero first and map last even if stored otherwise; duplicates/unknown dropped.
const messy = [sec("v5_store_map"), sec("v5_promo"), sec("v5_promo"), sec("rich_text"), sec("bogus"), { nope: 1 }, sec("v5_cinematic_hero")];
const fixed = normalizeHomepageLayout(messy as unknown[]);
assert.equal(fixed[0].type, FIXED_FIRST);
assert.equal(fixed[fixed.length - 1].type, FIXED_LAST);
assert.equal(fixed.length, V5_DEFAULT_ORDER.length, "each type once, missing types restored");

// Moves: fixed sections never move and nothing moves past them.
assert.equal(canMove(base, 0, 1), false, "hero cannot move");
assert.equal(canMove(base, 1, -1), false, "nothing moves above the hero");
assert.equal(canMove(base, base.length - 1, -1), false, "map cannot move");
assert.equal(canMove(base, base.length - 2, 1), false, "nothing moves below the map");
assert.equal(canMove(base, 2, -1), true);
assert.equal(moveSection(base, 0, 1), base, "refused move returns the same array");
const m2 = moveSection(base, 2, 1);
assert.equal(m2[3].type, base[2].type);
assert.equal(m2[2].type, base[3].type);

// Validation used by the API.
assert.deepEqual(homepageLayoutProblems(base), []);
assert.ok(homepageLayoutProblems([sec("v5_promo"), sec("v5_cinematic_hero")]).some((p) => /first/i.test(p)));
assert.ok(homepageLayoutProblems([sec("v5_store_map"), sec("v5_promo")]).some((p) => /last/i.test(p)));
assert.ok(homepageLayoutProblems([sec("v5_promo"), { ...sec("v5_promo"), id: "x" }]).some((p) => /once/i.test(p)));
assert.ok(homepageLayoutProblems([sec("rich_text")]).some((p) => /Unsupported/i.test(p)));
assert.ok(homepageLayoutProblems([sec("v5_promo"), { ...sec("v5_brand_grid"), id: "v5_promo" }]).some((p) => /unique id/i.test(p)));

// Section numbers: V5 order gives the original 01–11; they follow a moved section.
const n = sectionNumbers(base);
assert.deepEqual(
  [n.v5_product_story, n.v5_chromebook, n.v5_brand_grid, n.v5_featured_products, n.v5_promo, n.v5_spec_filters, n.v5_new_gen, n.v5_budget_bands, n.v5_compare_demo, n.v5_home_inquiry],
  ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11"],
);
assert.equal(sectionNumbers(moved).v5_promo, "05");
assert.equal(sectionNumbers(moved).v5_featured_products, "06");

console.log("homepage-layout tests passed");
