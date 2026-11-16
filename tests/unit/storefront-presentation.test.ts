import assert from "node:assert/strict";
import {
  DEFAULT_STOREFRONT_PRESENTATION,
  parseStorefrontPresentation,
  sectionLabel,
} from "../../src/lib/content/storefront-presentation";

// Client request: counts, angle labels and section numbers hidden by default.
assert.deepEqual(DEFAULT_STOREFRONT_PRESENTATION, { showCatalogCounts: false, showStoryAngleLabels: false, showSectionNumbers: false });
assert.deepEqual(parseStorefrontPresentation(null), DEFAULT_STOREFRONT_PRESENTATION);
assert.deepEqual(parseStorefrontPresentation([]), DEFAULT_STOREFRONT_PRESENTATION);
// Only real booleans override; truthy strings never re-enable a hidden label.
assert.deepEqual(parseStorefrontPresentation({ showCatalogCounts: "true", showSectionNumbers: 1 }), DEFAULT_STOREFRONT_PRESENTATION);
assert.equal(parseStorefrontPresentation({ showCatalogCounts: true }).showCatalogCounts, true);
assert.equal(parseStorefrontPresentation({ showCatalogCounts: true }).showStoryAngleLabels, false);

assert.equal(sectionLabel("02", "PRODUCT STORY", { showSectionNumbers: false }), "PRODUCT STORY");
assert.equal(sectionLabel("02", "PRODUCT STORY", { showSectionNumbers: true }), "02 — PRODUCT STORY");
console.log("storefront-presentation.test.ts: ok");
