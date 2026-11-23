import assert from "node:assert/strict";
import {
  applyPercentOff,
  applyFixedOff,
  campaignIsLive,
  priceWithCampaign,
  sumLinePricing,
  type DiscountCampaign,
} from "../../src/lib/commerce/pricing";
import { productSeoDefaults } from "../../src/lib/seo/product-meta";

const storewide5: DiscountCampaign = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Storewide 5% Off",
  description: "",
  kind: "percent",
  value: 5,
  scope: "storewide",
  status: "active",
  startsAt: null,
  endsAt: null,
  announcement: "FLAT 5% OFF",
  showAnnouncement: true,
  codeRequired: false,
};

const p = applyPercentOff(1_000_000, 5);
assert.equal(p.listPaisa, 1_000_000);
assert.equal(p.sellingPaisa, 950_000);
assert.equal(p.discountPaisa, 50_000);

const once = priceWithCampaign(1_000_000, storewide5);
assert.equal(once.sellingPaisa, 950_000);

const disabled = priceWithCampaign(1_000_000, { ...storewide5, status: "disabled" });
assert.equal(disabled.sellingPaisa, 1_000_000);
assert.equal(disabled.discountPaisa, 0);

const future: DiscountCampaign = {
  ...storewide5,
  status: "scheduled",
  startsAt: "2099-01-01T00:00:00.000Z",
};
assert.equal(campaignIsLive(future, new Date("2026-11-23T00:00:00Z")), false);

const s = sumLinePricing(
  [
    { listPaisa: 1_000_000, quantity: 2 },
    { listPaisa: 50_000, quantity: 1 },
  ],
  storewide5,
);
assert.equal(s.subtotalListPaisa, 2_050_000);
assert.equal(s.subtotalSellingPaisa, 1_947_500);
assert.equal(s.discountPaisa, 102_500);

const fixed = applyFixedOff(10_000, 50_000);
assert.equal(fixed.sellingPaisa, 0);
assert.equal(fixed.discountPaisa, 10_000);

const seo = productSeoDefaults({
  title: "Dell Latitude",
  brand: "Dell",
  model: "Latitude 5490",
  seoTitle: "Dell Latitude 5490 — Business Laptop",
  seoDescription: "Verified specs for this Latitude listing.",
});
assert.match(seo.title, /Dell Latitude 5490/);
assert.match(seo.description, /Verified specs/);

const fallback = productSeoDefaults({
  title: "HP EliteBook",
  brand: "HP",
  model: "EliteBook 840",
  config: "i5 · 16GB · 256GB",
  condition: "Used",
});
assert.doesNotMatch(fallback.description.toLowerCase(), /warranty|free delivery|cod guaranteed/);

console.log("pricing.test.ts ok");
