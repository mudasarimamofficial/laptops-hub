import assert from "node:assert/strict";
import {
  collapseAdjacentDuplicateWords,
  formatProductDisplayName,
  formatProductSeoTitleParts,
} from "../../src/lib/catalog/product-display-name";
import { productSeoDefaults } from "../../src/lib/seo/product-meta";
import { priceWithCampaign, type DiscountCampaign } from "../../src/lib/commerce/pricing";

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

check("Dell already in model", () => {
  assert.equal(formatProductDisplayName("Dell", "Dell Latitude 3440"), "Dell Latitude 3440");
});
check("HP without brand in model", () => {
  assert.equal(formatProductDisplayName("HP", "EliteBook 840"), "HP EliteBook 840");
});
check("Lenovo already prefixed", () => {
  assert.equal(formatProductDisplayName("Lenovo", "Lenovo ThinkPad T14"), "Lenovo ThinkPad T14");
});
check("ASUS mixed case prefix", () => {
  assert.equal(formatProductDisplayName("ASUS", "asus VivoBook 15"), "asus VivoBook 15");
});
check("hyphenated model keeps brand once", () => {
  assert.equal(formatProductDisplayName("Dell", "Dell-Latitude 3440"), "Dell-Latitude 3440");
});
check("empty brand uses model", () => {
  assert.equal(formatProductDisplayName("", "Latitude 3440"), "Latitude 3440");
});
check("empty model uses brand", () => {
  assert.equal(formatProductDisplayName("Dell", ""), "Dell");
});
check("collapse adjacent duplicates", () => {
  assert.equal(collapseAdjacentDuplicateWords("Dell Dell Latitude"), "Dell Latitude");
});
check("seo title no brand · brand model", () => {
  assert.equal(
    formatProductSeoTitleParts({ brand: "Dell", model: "Dell Latitude 3440", config: "i5 8GB" }),
    "Dell Latitude 3440 · i5 8GB",
  );
});
check("seo defaults preserve override", () => {
  const r = productSeoDefaults({
    title: "Dell Latitude 3440 - Core i5",
    brand: "Dell",
    model: "Dell Latitude 3440",
    config: "8GB",
    seoTitle: "Custom SEO Title",
  });
  assert.equal(r.title, "Custom SEO Title");
});
check("seo defaults avoid Dell · Dell", () => {
  const r = productSeoDefaults({
    title: "Dell Latitude 3440 - Core i5",
    brand: "Dell",
    model: "Dell Latitude 3440",
    config: "8GB RAM",
  });
  assert.ok(!r.title.toLowerCase().startsWith("dell · dell"));
  assert.ok(r.title.startsWith("Dell Latitude 3440"));
});
check("non-storewide campaign does not discount", () => {
  const campaign: DiscountCampaign = {
    id: "x",
    name: "Products only",
    description: "",
    kind: "percent",
    value: 5,
    scope: "products",
    status: "active",
    startsAt: null,
    endsAt: null,
    announcement: "",
    showAnnouncement: true,
    codeRequired: false,
  };
  const priced = priceWithCampaign(1_000_000, campaign);
  assert.equal(priced.sellingPaisa, 1_000_000);
  assert.equal(priced.discountPaisa, 0);
});
check("storewide still discounts", () => {
  const campaign: DiscountCampaign = {
    id: "y",
    name: "Storewide 5% Off",
    description: "",
    kind: "percent",
    value: 5,
    scope: "storewide",
    status: "active",
    startsAt: null,
    endsAt: null,
    announcement: "",
    showAnnouncement: true,
    codeRequired: false,
  };
  const priced = priceWithCampaign(1_000_000, campaign);
  assert.equal(priced.sellingPaisa, 950_000);
});

console.log("product-display-name tests passed");
