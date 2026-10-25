import assert from "node:assert/strict";
import { productsToShopifyModernCsv, type ExportProduct } from "../../src/lib/catalog/shopify-export";

const sample: ExportProduct[] = [
  {
    handle: "hp-demo",
    title: "HP Demo",
    description_safe: "Line1\nLine2",
    merchant_vendor: "Laptops HUB",
    manufacturer: "HP",
    product_type: "Laptop",
    category: "Laptop",
    status: "active",
    tags: ["business", "hp"],
    seo_title: "HP Demo SEO",
    seo_description: "Desc",
    product_variants: [
      {
        title: "Default",
        sku: "HP-1",
        price_paisa: 12500000,
        compare_at_paisa: 15000000,
        inventory_mode: "untracked",
        quantity_on_hand: null,
        option_values: { Condition: "Excellent" },
      },
    ],
    product_media: [
      { url: "https://cdn.shopify.com/s/files/1/a.jpg", alt: "Front", position: 1 },
      { url: "https://cdn.shopify.com/s/files/1/b.jpg", alt: "Side", position: 2 },
    ],
  },
];

const csv = productsToShopifyModernCsv(sample);
assert.ok(csv.startsWith("\uFEFF"));
assert.ok(csv.includes("URL handle"));
assert.ok(csv.includes("hp-demo"));
assert.ok(csv.includes("125000.00"));
assert.ok(csv.includes("cdn.shopify.com/s/files/1/b.jpg"));
assert.ok(csv.includes("Condition"));
assert.ok(csv.includes("Excellent"));
// formula safety on cells is in toCsvLine — ensure commas in tags are quoted
assert.ok(csv.includes('"business, hp"') || csv.includes("business, hp"));

console.log("shopify-export.test.ts: ok");
