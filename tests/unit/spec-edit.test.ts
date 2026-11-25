import assert from "node:assert/strict";
import { SPEC_TABLE_FIELDS, applySpecEdit, specEditFromStored, specEditSchema } from "../../src/lib/catalog/spec-edit";
import { toV5, v5SpecRows } from "../../src/lib/catalog/v5-model";

// Production-shaped specs: filter keys + table rows + import references the storefront never shows.
const stored = {
  model: "Dell 5400",
  config: "Core i5, 8th Gen, 8GB RAM, 256GB Storage",
  cpu: "i5",
  gen: 8,
  ram: "8GB",
  storage: "256GB",
  size: 14,
  touch: null,
  condition: null,
  Processor: "Intel Core i5-8365U",
  "Memory (CRM config)": "8GB",
  crm_ref: "X-12",
};

const e = specEditFromStored(stored);
assert.deepEqual(
  { ...e, table: undefined },
  { model: "Dell 5400", config: "Core i5, 8th Gen, 8GB RAM, 256GB Storage", cpu: "i5", gen: 8, ramGb: 8, storageGb: 256, sizeIn: 14, touch: false, condition: "", table: undefined },
);
assert.deepEqual(Object.keys(e.table), SPEC_TABLE_FIELDS.map(([k]) => k), "editor shows exactly the storefront table rows");
assert.equal(e.table.Processor, "Intel Core i5-8365U");
assert.equal(e.table.Display, "");
assert.equal(specEditFromStored({ sto: "1TB" }).storageGb, 1024);
assert.equal(specEditFromStored({ condition: "Like new!!" }).condition, "", "unknown condition is not guessed");

// Saving with no edits changes nothing the storefront reads, and keeps the import references.
const same = applySpecEdit(stored, e);
for (const k of Object.keys(stored) as (keyof typeof stored)[]) assert.deepEqual(same[k], stored[k], k);

// Edits: new values, a table row added and one cleared, cleared fields become null.
const edited = applySpecEdit(stored, {
  ...e,
  ramGb: 16,
  storageGb: 1024,
  gen: null,
  touch: true,
  condition: "Used",
  table: { ...e.table, Processor: "", Display: " 14-inch FHD ", Condition: "Used" },
});
assert.equal(edited.ram, "16GB");
assert.equal(edited.storage, "1024GB");
assert.equal(edited.gen, null);
assert.equal(edited.touch, true);
assert.equal(edited.condition, "Used");
assert.equal(edited.Display, "14-inch FHD");
assert.equal("Processor" in edited, false, "a cleared table row is removed");
assert.equal(edited["Memory (CRM config)"], "8GB");
assert.equal(edited.crm_ref, "X-12");

// The storefront model reads the edited values (chips, condition, key specs, spec table).
const v5 = toV5(
  { handle: "h", title: "Dell 5400", category: "laptop", manufacturer: "Dell", pricePaisa: 100, images: [], specs: edited, available: true } as never,
  0,
);
assert.equal(v5.ramN, 16);
assert.equal(v5.cond, "Used");
assert.equal(v5.touch, true);
assert.ok(v5.chips.includes("16GB RAM"));
assert.ok(v5.chips.includes("1TB"));
assert.deepEqual(
  v5SpecRows(v5).map((r) => r.k),
  ["Display", "Condition"],
);

// Schema limits: whole numbers, ranges, known conditions, known table rows only.
assert.equal(specEditSchema.safeParse(e).success, true);
assert.equal(specEditSchema.safeParse({ ...e, gen: 8.5 }).success, false);
assert.equal(specEditSchema.safeParse({ ...e, ramGb: 99999 }).success, false);
assert.equal(specEditSchema.safeParse({ ...e, condition: "Mint" }).success, false);
assert.equal(specEditSchema.safeParse({ ...e, table: { "Memory (CRM config)": "x" } }).success, false);
assert.equal(specEditSchema.safeParse({ ...e, table: { Display: "x".repeat(301) } }).success, false);

console.log("spec-edit.test.ts: ok");
