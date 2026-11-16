import assert from "node:assert/strict";
import {
  csvSafeCell,
  detectShopifyCsvProfile,
  stageShopifyRows,
  summarizeStaging,
  toCsvLine,
} from "../../src/lib/catalog/shopify-csv";

const legacyHeaders = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Price",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "Status",
];

const modernHeaders = [
  "Title",
  "URL handle",
  "Description",
  "Vendor",
  "Type",
  "Tags",
  "Status",
  "Option1 name",
  "Option1 value",
  "SKU",
  "Price",
  "Product image URL",
  "Image position",
  "Image alt text",
];

{
  const d = detectShopifyCsvProfile(legacyHeaders);
  assert.equal(d.profile, "legacy");
  assert.equal(d.mapped.handle, "Handle");
  assert.equal(d.mapped.imageSrc, "Image Src");
}

{
  const d = detectShopifyCsvProfile(modernHeaders);
  assert.equal(d.profile, "modern");
  assert.equal(d.mapped.handle, "URL handle");
  assert.equal(d.mapped.imageSrc, "Product image URL");
}

{
  const mapped = detectShopifyCsvProfile(legacyHeaders).mapped;
  const rows: Record<string, string>[] = [
    {
      Handle: "hp-elitebook",
      Title: "HP EliteBook",
      "Variant SKU": "SKU-1",
      "Variant Price": "125000.00",
      "Option1 Name": "Condition",
      "Option1 Value": "Excellent",
      "Image Src": "https://cdn.shopify.com/s/files/1/x.jpg",
      "Image Position": "1",
    },
    {
      Handle: "hp-elitebook",
      Title: "",
      "Image Src": "https://cdn.shopify.com/s/files/1/y.jpg",
      "Image Position": "2",
    },
    {
      Handle: "dell-latitude",
      Title: "Dell Latitude",
      "Variant Price": "99000",
    },
  ];
  const staged = stageShopifyRows(rows, mapped);
  assert.equal(staged.products.length, 2);
  const hp = staged.products.find((p) => p.handle === "hp-elitebook");
  assert.ok(hp);
  assert.ok(hp!.imageOnlyRows.length >= 1);
  const summary = summarizeStaging(staged.products, []);
  assert.equal(summary.productCount, 2);
}

{
  assert.equal(csvSafeCell("=cmd"), "'=cmd");
  assert.equal(csvSafeCell("normal"), "normal");
  assert.equal(toCsvLine(["a", 'b"c', "d,e"]), 'a,"b""c","d,e"');
}

console.log("shopify-csv.test.ts: ok");
