import assert from "node:assert/strict";
import { productMatchesRule, type CollectionRule } from "../../src/lib/collections/rule-eval";
import type { PublicProduct } from "../../src/types/catalog";

const base: PublicProduct = {
  id: "1",
  handle: "hp-elite",
  title: "HP EliteBook 840",
  descriptionSafe: "",
  manufacturer: "HP",
  productType: "Laptop",
  category: "Laptop",
  featured: false,
  tags: ["business"],
  specs: { RAM: "16 GB", Display: "14 inch" },
  variantId: "v1",
  sku: "SKU",
  pricePaisa: 12500000,
  compareAtPaisa: null,
  maxPerOrder: 5,
  available: true,
  images: [],
};

const rule: CollectionRule = {
  match: "all",
  conditions: [
    { field: "manufacturer", op: "eq", value: "HP" },
    { field: "specs.ram_gb", op: "gte", value: 16 },
  ],
};

assert.equal(productMatchesRule(base, rule), true);
assert.equal(productMatchesRule({ ...base, manufacturer: "Dell" }, rule), false);
assert.equal(
  productMatchesRule({ ...base, specs: { RAM: "8 GB" } }, rule),
  false,
);

const anyRule: CollectionRule = {
  match: "any",
  conditions: [
    { field: "manufacturer", op: "eq", value: "Dell" },
    { field: "tags", op: "contains", value: "business" },
  ],
};
assert.equal(productMatchesRule(base, anyRule), true);

console.log("collection-rule-eval.test.ts: ok");
