import assert from "node:assert/strict";
import {
  generateVariantMatrix,
  optionValuesEqual,
  parseOptionValuesCsv,
} from "../../src/lib/catalog/variant-matrix";

const empty = generateVariantMatrix([]);
assert.equal(empty.rows.length, 1);
assert.equal(empty.rows[0].title, "Default");

const matrix = generateVariantMatrix([
  { name: "RAM", values: ["8GB", "16GB"] },
  { name: "Storage", values: ["256GB", "512GB"] },
]);
assert.equal(matrix.rows.length, 4);
assert.equal(matrix.rows[0].title, "8GB / 256GB");
assert.deepEqual(matrix.rows[3].optionValues, { RAM: "16GB", Storage: "512GB" });

assert.deepEqual(parseOptionValuesCsv("8GB, 16GB | 32GB\n64GB"), ["8GB", "16GB", "32GB", "64GB"]);

assert.equal(optionValuesEqual({ a: "1", b: "2" }, { b: "2", a: "1" }), true);
assert.equal(optionValuesEqual({ a: "1" }, { a: "2" }), false);

const capped = generateVariantMatrix([
  { name: "A", values: Array.from({ length: 20 }, (_, i) => `a${i}`) },
  { name: "B", values: Array.from({ length: 20 }, (_, i) => `b${i}`) },
]);
assert.ok(capped.errors.some((e) => /max 250/i.test(e)));
assert.equal(capped.rows.length, 250);

console.log("variant-matrix.test.ts: ok");
