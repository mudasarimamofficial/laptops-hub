/** G13: product media rules (URL checks, alt text, order, imported placeholders). */
import assert from "node:assert/strict";
import { checkExternalImageUrl, cleanAlt, isImportedAlt, MediaInputError, moveToFront, orderProblem } from "../../src/lib/catalog/media-order";
import { merchantAlt } from "../../src/lib/catalog/v5-model";

const bad = (u: string, re: RegExp) => assert.throws(() => checkExternalImageUrl(u), (e: unknown) => e instanceof MediaInputError && re.test(e.message), u);
assert.equal(checkExternalImageUrl("https://cdn.shopify.com/s/files/1/abc?v=1"), "https://cdn.shopify.com/s/files/1/abc?v=1");
assert.equal(checkExternalImageUrl(" https://example.com/a/photo.WEBP "), "https://example.com/a/photo.WEBP");
bad("http://example.com/a.jpg", /secure/);
bad("ftp://example.com/a.jpg", /secure/);
bad("not a url", /not a web address/);
bad("https://user:pw@example.com/a.jpg", /password/);
bad("https://localhost/a.jpg", /public website/);
bad("https://10.0.0.5/a.jpg", /public website/);
bad("https://169.254.169.254/latest/meta-data", /public website/);
bad("https://[::1]/a.jpg", /public website/);
bad("https://intranet/a.jpg", /public website/);
bad("https://example.com/page.html", /image file/);
bad("https://example.com/download?file=a.jpg", /image file/);

assert.equal(cleanAlt("  Dell   Latitude\n7420  front "), "Dell Latitude 7420 front");
assert.equal(cleanAlt(42), "");
assert.equal(cleanAlt("x".repeat(400)).length, 300);

assert.equal(orderProblem(["a", "b", "c"], ["c", "a", "b"]), null);
assert.match(orderProblem(["a", "b", "c"], ["a", "b"])!, /another window/);
assert.match(orderProblem(["a", "b"], ["a", "a"])!, /twice/);
assert.match(orderProblem(["a", "b"], ["a", "z"])!, /another window/);
assert.deepEqual(moveToFront(["a", "b", "c"], "c"), ["c", "a", "b"]);
assert.deepEqual(moveToFront(["a", "b", "c"], "a"), ["a", "b", "c"]);
assert.deepEqual(moveToFront(["a", "b"], "z"), ["a", "b"]);

// Production's imported placeholders (all 964 rows on 2026-11-26 match one of these shapes).
for (const a of ["LATITUDE 5320 I5 11TH 16/256 DELL view 6", "LENOVO T490S I7 8TH 16/256 LENOVO front view", "SKU-00209 product image", "Surface 45W/65W Charger view 3"]) {
  assert.ok(isImportedAlt(a), a);
  assert.equal(merchantAlt(a, "Some product"), "");
}
assert.ok(!isImportedAlt("Dell Latitude 7420 with the lid open, showing the keyboard"));
assert.equal(merchantAlt("Dell Latitude 7420 with the lid open", "Dell Latitude 7420"), "Dell Latitude 7420 with the lid open");
assert.equal(merchantAlt("dell latitude 7420 ", "Dell Latitude 7420"), "");
assert.equal(merchantAlt(null, "X"), "");

console.log("product-media-rules: ok");
