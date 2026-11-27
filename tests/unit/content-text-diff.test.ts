import assert from "node:assert/strict";
import { diffLines, htmlToLines } from "../../src/lib/content/text-diff";

assert.deepEqual(htmlToLines("<h2>Care</h2><p>Keep vents&nbsp;clear.</p><ul><li>Hard surface</li><li>No food</li></ul>"), [
  "Care",
  "Keep vents clear.",
  "Hard surface",
  "No food",
]);
assert.deepEqual(htmlToLines(""), []);
assert.deepEqual(htmlToLines("<p>a &amp; b &lt;c&gt;</p>"), ["a & b <c>"]);

const d = diffLines(["Care", "Keep vents clear.", "No food"], ["Care", "Keep vents clear and dry.", "No food", "Use a sleeve"]);
assert.deepEqual(
  d.map((x) => `${x.kind}:${x.text}`),
  ["same:Care", "removed:Keep vents clear.", "added:Keep vents clear and dry.", "same:No food", "added:Use a sleeve"],
);
assert.deepEqual(diffLines([], ["x"]), [{ kind: "added", text: "x" }]);
assert.deepEqual(diffLines(["x"], []), [{ kind: "removed", text: "x" }]);
assert.ok(diffLines(["a", "b"], ["a", "b"]).every((x) => x.kind === "same"));
// Very long inputs fall back to remove-all/add-all instead of a huge table.
const big = Array.from({ length: 600 }, (_, i) => `line ${i}`);
assert.equal(diffLines(big, big.slice(1)).length, 1199);
console.log("content-text-diff: ok");
