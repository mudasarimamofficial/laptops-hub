import assert from "node:assert/strict";
import {
  cleanSpecValue,
  curateSpecs,
  formatCpu,
  isSpecDumpParagraph,
  modelName,
  ordinal,
  publicDescription,
  publicTags,
  toPublicSpecs,
} from "../../src/lib/catalog/specs";

// Fixture mirrors the shape written by scripts/import-catalog.mjs for the Dell Latitude 7420 (catalog snapshot).
const dell = {
  manufacturer: "Dell",
  sku: "LH-7420",
  specs: {
    cpu: "i5",
    gen: 11,
    ram: "16GB",
    storage: "256GB",
    size: 14,
    condition: "Used",
    touch: null,
    model: "Latitude 7420",
    config: "Core i5 11th Gen · 16GB · 256GB",
    Processor: "Core I5 11th Gen (11th Generation Core i5 1145G7 Processor)",
    "Memory (CRM config)": "16GB",
    "Storage (CRM config)": "256GB",
    Graphics: "Intel Iris Xe Graphics",
    Display: '14" Full HD 1080p 60Hz Touch Display',
    "Resolution / panel": "1920 x 1080p",
    "Operating system (source reference)": "Windows 11 Pro",
    Condition: "Used",
  },
};

const rows = curateSpecs(dell);
assert.deepEqual(
  rows.map((r) => r.label),
  ["Brand", "Model", "Processor", "RAM", "Storage", "Display", "Resolution", "Graphics", "Operating system", "Condition", "SKU"],
);
assert.equal(rows.find((r) => r.label === "Processor")?.value, dell.specs.Processor, "verbatim source processor preferred");
assert.equal(rows.find((r) => r.label === "Display")?.value, dell.specs.Display);
// No internal key names leak into labels
for (const r of rows) {
  assert.equal(/crm|source reference|^[a-z]/.test(r.label), false, `bad label ${r.label}`);
}

// Title-parsed product (182 new products only have short keys)
const parsed = curateSpecs({
  manufacturer: "Dell",
  sku: null,
  specs: { cpu: "i3", gen: 6, ram: "4GB", storage: "180GB", size: null, condition: null, touch: false, model: "Latitude 5470" },
});
assert.deepEqual(parsed, [
  { label: "Brand", value: "Dell" },
  { label: "Model", value: "Latitude 5470" },
  { label: "Processor", value: "Core i3, 6th gen" },
  { label: "RAM", value: "4GB" },
  { label: "Storage", value: "180GB" },
]);
// touch:false must not produce "No"; missing condition must not be filled
assert.equal(parsed.some((r) => r.label === "Touchscreen" || r.label === "Condition" || r.label === "Display"), false);

// Merchant vendor is not a brand
assert.equal(curateSpecs({ manufacturer: "Laptops HUB", sku: null, specs: {} }).length, 0);
// Size-only display, touch true
const small = curateSpecs({ manufacturer: null, sku: null, specs: { size: 13.3, touch: true } });
assert.deepEqual(small, [
  { label: "Display", value: '13.3"' },
  { label: "Touchscreen", value: "Yes" },
]);
// Gen without cpu is not shown as a processor
assert.equal(curateSpecs({ manufacturer: null, sku: null, specs: { gen: 8 } }).length, 0);
// Placeholder values ignored; objects ignored
assert.equal(cleanSpecValue("null"), null);
assert.equal(cleanSpecValue("  "), null);
assert.equal(cleanSpecValue({ a: 1 }), null);
assert.equal(cleanSpecValue(Number.NaN), null);
assert.equal(cleanSpecValue("  16GB  "), "16GB");

assert.equal(ordinal(1), "1st");
assert.equal(ordinal(11), "11th");
assert.equal(ordinal(12), "12th");
assert.equal(ordinal(22), "22nd");
assert.equal(formatCpu("i7"), "Core i7");
assert.equal(formatCpu("Ryzen 5"), "Ryzen 5");
assert.equal(modelName("HP EliteBook 840 G7 - Core i5", {}), "HP EliteBook 840 G7");
assert.equal(modelName("X", { model: "Y" }), "Y");

// description_safe: drop only the generated key/value dump (values may contain " · ")
const dump = "Processor: Core i5 · 11th gen · Memory (CRM config): 8GB · Storage (CRM config): 256GB";
assert.equal(isSpecDumpParagraph(dump), true);
assert.equal(isSpecDumpParagraph("Processor: Core i5"), true, "single generated entry");
assert.equal(isSpecDumpParagraph("Resolution / panel: 1920 x 1080p · Operating system (source reference): Windows 11 Pro"), true);
assert.equal(isSpecDumpParagraph("A clean business laptop. Ships tested."), false);
assert.equal(isSpecDumpParagraph("Note: battery replaced"), false, "unknown key is not treated as generated");
assert.equal(isSpecDumpParagraph("Processor: "), false);
assert.equal(publicDescription(`Business laptop in used condition.\n\n${dump}`), "Business laptop in used condition.");
assert.equal(publicDescription(dump), "");
assert.equal(publicDescription(""), "");

// Public boundary: internal key labels renamed/dropped, values unchanged
const pub = toPublicSpecs({
  ...dell.specs,
  "Memory (source reference)": "8GB",
  "Storage (source reference)": "128GB",
  Note: "internal",
});
assert.equal(/crm|source reference/i.test(JSON.stringify(Object.keys(pub))), false);
assert.equal(pub.Memory, "16GB");
assert.equal(pub.Storage, "256GB");
assert.equal(pub["Operating system"], "Windows 11 Pro");
assert.equal("Note" in pub, false);
assert.equal(pub.cpu, "i5", "short keys kept");
assert.deepEqual(curateSpecs({ ...dell, specs: pub }), rows, "curated rows identical before/after boundary");
assert.deepEqual(toPublicSpecs(null), {});

assert.deepEqual(publicTags(["CONFIG_REVIEW", "IDENTITY_REVIEW_SOFT", "charger", "Business"]), ["charger", "Business"]);
assert.deepEqual(publicTags(null), []);

console.log("specs.test.ts ok");