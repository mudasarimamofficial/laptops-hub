import assert from "node:assert/strict";
import {
  detectShopifyCsvProfile,
  parseCsvText,
  stageShopifyRows,
  toCsvLine,
  unguardCsvCell,
  type CanonicalField,
} from "../../src/lib/catalog/shopify-csv";

// One parser for preview and commit: quoted commas, doubled quotes, line breaks, BOM. The server copy used to split
// quoted cells at commas, so HTML descriptions and tag lists were misaligned on commit while the preview looked right.
{
  const text =
    "﻿Handle,Title,Body (HTML),Tags\r\n" +
    'a-1,"Dell, Latitude","<p>Fast, light</p>\n<p>Say ""hi""</p>","office, student"\r\n\r\n';
  const { headers, rows } = parseCsvText(text);
  assert.deepEqual(headers, ["Handle", "Title", "Body (HTML)", "Tags"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Title, "Dell, Latitude");
  assert.equal(rows[0]["Body (HTML)"], '<p>Fast, light</p>\n<p>Say "hi"</p>');
  assert.equal(rows[0].Tags, "office, student");
}

// Export guard round trip: a cell starting with - = + @ keeps its text after export + import.
for (const original of ["-15% clearance", "=SUM(A1)", "+bundle", "@home", "plain", "it's fine"]) {
  const parsed = parseCsvText("H\n" + toCsvLine([original]) + "\n").rows[0].H;
  assert.equal(unguardCsvCell(parsed), original, original);
}

// Staging applies the unguard, so the product title is the original text.
{
  const { headers, rows } = parseCsvText('Handle,Title,Variant Price\nx,"-Promo, A",10\n');
  const detected = detectShopifyCsvProfile(headers);
  const staged = stageShopifyRows(rows, detected.mapped as Partial<Record<CanonicalField, string>>);
  assert.equal(staged.products[0].title, "-Promo, A");
}

console.log("shopify-csv-parse.test.ts: ok");
