import assert from "node:assert/strict";
import { optionValues, pickerModel, resolveChoice, valueState, variantLabel } from "../../src/components/commerce/variant-picker";
import type { PublicVariant } from "../../src/types/catalog";

const v = (id: string, optionValues: Record<string, string>, pricePaisa: number, available = true, title = "", sku: string | null = null): PublicVariant => ({
  id,
  sku,
  title: title || Object.values(optionValues).join(" / ") || "Default",
  optionValues,
  pricePaisa,
  compareAtPaisa: null,
  maxPerOrder: 2,
  available,
  mediaId: null,
});

// ── 1 dimension (the visually tested RAM product) ────────────────────────────────────────────────────────────────
const ram = [v("a", { RAM: "8GB" }, 8500000), v("b", { RAM: "16GB" }, 9500000)];
const m1 = pickerModel(["RAM"], ram);
assert.deepEqual(m1, { mode: "options", names: ["RAM"] });
assert.equal(resolveChoice(ram, ["RAM"], ram[0], "RAM", "16GB").id, "b");
assert.equal(resolveChoice(ram, ["RAM"], ram[1], "RAM", "8GB").id, "a");
assert.equal(variantLabel(ram[1], m1, ram), "16GB");

// ── 2 dimensions: every combination resolves to its own variant ──────────────────────────────────────────────────
const two = [
  v("r8s256", { RAM: "8GB", Storage: "256GB" }, 8000000),
  v("r8s512", { RAM: "8GB", Storage: "512GB" }, 8500000),
  v("r16s256", { RAM: "16GB", Storage: "256GB" }, 9000000, false), // sold out
  v("r16s512", { RAM: "16GB", Storage: "512GB" }, 9500000),
];
const n2 = ["RAM", "Storage"];
assert.deepEqual(pickerModel(n2, two), { mode: "options", names: n2 });
assert.equal(resolveChoice(two, n2, two[0], "Storage", "512GB").id, "r8s512");
assert.equal(resolveChoice(two, n2, two[1], "RAM", "16GB").id, "r16s512");
// Choosing a sold-out exact combination selects THAT variant (shown as sold out), never a different one.
assert.equal(resolveChoice(two, n2, two[0], "RAM", "16GB").id, "r16s256");
assert.equal(valueState(two, n2, two[0], "RAM", "16GB"), "soldout");
assert.equal(valueState(two, n2, two[1], "RAM", "16GB"), "available");
assert.equal(valueState(two, n2, two[0], "RAM", "8GB"), "selected");
assert.equal(variantLabel(two[3], pickerModel(n2, two), two), "16GB / 512GB");

// ── 3 dimensions with a missing combination ──────────────────────────────────────────────────────────────────────
const three = [
  v("1", { CPU: "i5", RAM: "8GB", Color: "Silver" }, 1),
  v("2", { CPU: "i5", RAM: "16GB", Color: "Silver" }, 2),
  v("3", { CPU: "i7", RAM: "16GB", Color: "Silver" }, 3),
  v("4", { CPU: "i7", RAM: "16GB", Color: "Black" }, 4),
];
const n3 = ["CPU", "RAM", "Color"];
assert.deepEqual(pickerModel(n3, three), { mode: "options", names: n3 });
// i5/8GB/Silver → choose i7: no i7/8GB exists → closest real variant keeping Silver = i7/16GB/Silver.
assert.equal(valueState(three, n3, three[0], "CPU", "i7"), "unavailable");
assert.equal(resolveChoice(three, n3, three[0], "CPU", "i7").id, "3");
assert.equal(resolveChoice(three, n3, three[2], "Color", "Black").id, "4");
assert.deepEqual(optionValues("Color", three), ["Silver", "Black"]);
// Every variant is reachable from every other through the picker.
for (const from of three) for (const to of three) {
  let cur = from;
  for (const n of n3) cur = resolveChoice(three, n3, cur, n, to.optionValues[n]);
  assert.equal(cur.id, to.id, `reach ${to.id} from ${from.id}`);
}

// ── missing option_names: derived from option_values ─────────────────────────────────────────────────────────────
assert.deepEqual(pickerModel([], two), { mode: "options", names: ["RAM", "Storage"] });

// ── multiple variants, NO option data at all: list the variants themselves ───────────────────────────────────────
const bare = [v("x", {}, 1, true, "Grade A"), v("y", {}, 2, true, "Grade B")];
const mb = pickerModel([], bare);
assert.deepEqual(mb, { mode: "list", label: "Option" });
assert.deepEqual(bare.map((b) => variantLabel(b, mb, bare)), ["Grade A", "Grade B"]);

// ── partial option values (one variant lacks Storage) → list mode, nothing unreachable ───────────────────────────
const partial = [v("p1", { RAM: "8GB", Storage: "256GB" }, 1), v("p2", { RAM: "16GB" }, 2)];
assert.equal(pickerModel(["RAM", "Storage"], partial).mode, "list");
assert.equal(pickerModel(["RAM"], partial).mode, "options"); // RAM alone is complete and unique

// ── duplicate combinations or titles → list mode with distinguishable labels ─────────────────────────────────────
const dup = [v("d1", { RAM: "8GB" }, 1, true, "8GB", "SKU-A"), v("d2", { RAM: "8GB" }, 2, true, "8GB", "SKU-B"), v("d3", {}, 3, true, "Default")];
const md = pickerModel(["RAM"], dup);
assert.equal(md.mode, "list");
const labels = dup.map((d) => variantLabel(d, md, dup));
assert.deepEqual(labels, ["8GB (SKU-A)", "8GB (SKU-B)", "Option 3"]);
assert.equal(new Set(labels).size, dup.length);

console.log("variant-picker.test.ts: ok");
