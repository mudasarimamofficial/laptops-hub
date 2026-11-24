import assert from "node:assert/strict";
import {
  DEFAULT_PRODUCT_LAYOUT,
  PRODUCT_SECTION_IDS,
  cleanLayoutForSave,
  isProductSectionVisible,
  layoutFromThemeSettings,
  productLayout,
  themeLayout,
  themeLayoutProblems,
} from "../../src/lib/content/theme-layout";

// Defaults: V5 order, everything visible, 4 related.
assert.deepEqual(productLayout(undefined), DEFAULT_PRODUCT_LAYOUT);
assert.deepEqual(themeLayout().product, DEFAULT_PRODUCT_LAYOUT);
assert.deepEqual(
  DEFAULT_PRODUCT_LAYOUT.sections.map((s) => s.id),
  [...PRODUCT_SECTION_IDS],
);

// Corrupt / tampered stored values never break the page: unknown ids dropped, duplicates ignored, missing appended.
const l = productLayout({
  sections: [{ id: "related", visible: false }, { id: "evil" }, { id: "related", visible: true }, "x", { id: "details" }],
  showKeySpecs: "no",
  showPolicies: false,
  relatedCount: 5,
});
assert.deepEqual(
  l.sections,
  [
    { id: "related", visible: false },
    { id: "details", visible: true },
    { id: "reviews", visible: true },
  ],
);
assert.equal(l.showKeySpecs, true, "non-boolean falls back to shown");
assert.equal(l.showPolicies, false);
assert.equal(l.relatedCount, 4, "unsupported count falls back to 4");
assert.equal(isProductSectionVisible(l, "related"), false);
assert.equal(isProductSectionVisible(l, "reviews"), true);
assert.equal(productLayout({ relatedCount: 8 }).relatedCount, 8);

// theme_settings extraction
assert.deepEqual(layoutFromThemeSettings(null), {});
assert.deepEqual(layoutFromThemeSettings({ layout: [] }), {});
assert.deepEqual(layoutFromThemeSettings({ layout: { product: {} } }), { product: {} });

// Validation (API): editor values pass; tampered ones are reported.
assert.deepEqual(themeLayoutProblems(undefined), []);
assert.deepEqual(themeLayoutProblems({ product: DEFAULT_PRODUCT_LAYOUT }), []);
assert.ok(themeLayoutProblems([]).length);
assert.ok(themeLayoutProblems({ product: { sections: [{ id: "nope" }] } }).length);
assert.ok(themeLayoutProblems({ product: { sections: [{ id: "details" }, { id: "details" }] } }).length);
assert.ok(themeLayoutProblems({ product: { sections: [{ id: "details", visible: "yes" }] } }).length);
assert.ok(themeLayoutProblems({ product: { showPolicies: 1 } }).length);
assert.ok(themeLayoutProblems({ product: { relatedCount: 100 } }).length);

// Save form: default layout stores nothing; changes store the full normalised product layout.
assert.deepEqual(cleanLayoutForSave({}), {});
assert.deepEqual(cleanLayoutForSave({ product: DEFAULT_PRODUCT_LAYOUT }), {});
const saved = cleanLayoutForSave({ product: { showPolicies: false } }) as { product: typeof DEFAULT_PRODUCT_LAYOUT };
assert.equal(saved.product.showPolicies, false);
assert.equal(saved.product.sections.length, 3);
assert.deepEqual(cleanLayoutForSave({ product: { sections: [{ id: "reviews" }] }, junk: 1 }), {
  product: { ...DEFAULT_PRODUCT_LAYOUT, sections: [{ id: "reviews", visible: true }, { id: "details", visible: true }, { id: "related", visible: true }] },
});

console.log("theme-layout tests passed");
