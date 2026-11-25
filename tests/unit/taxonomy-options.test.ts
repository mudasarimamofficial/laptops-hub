import assert from "node:assert/strict";
import { canonicalBrand, canonicalCategory, isKnownCategory, CATEGORY_OPTIONS } from "../../src/lib/catalog/taxonomy-options";
import { toV5 } from "../../src/lib/catalog/v5-model";

// Every admin category option maps to its storefront category (none falls back to "laptop" by accident).
const expected: Record<string, string> = {
  Laptop: "laptop",
  "Gaming laptop": "gaming",
  Chromebook: "chromebook",
  MacBook: "macbook",
  Tablet: "tablet",
  Accessory: "accessory",
};
for (const c of CATEGORY_OPTIONS) {
  const p = toV5({ handle: "x", title: "X", category: c, manufacturer: "Dell", pricePaisa: 100, images: [], specs: {}, available: true } as never, 0);
  assert.equal(p.cat, expected[c], c);
}

assert.equal(canonicalCategory("macbook"), "MacBook");
assert.equal(canonicalCategory("  gaming   LAPTOP "), "Gaming laptop");
assert.equal(canonicalCategory(""), null);
assert.equal(canonicalCategory(null), null);
assert.equal(canonicalCategory("Business"), "Business"); // unknown kept as typed, never invented
assert.equal(isKnownCategory("Business"), false);
assert.equal(isKnownCategory("Tablet"), true);

assert.equal(canonicalBrand("dell"), "Dell");
assert.equal(canonicalBrand("asus"), "ASUS");
assert.equal(canonicalBrand("hp "), "HP");
assert.equal(canonicalBrand("Jabra"), "Jabra");
assert.equal(canonicalBrand("   "), null);

console.log("taxonomy-options: ok");
