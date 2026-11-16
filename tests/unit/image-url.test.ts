import assert from "node:assert/strict";
import { imageSrcSet, sizedImage } from "../../src/lib/catalog/image-url";

const cdn = "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/a.webp?v=1792934111";
assert.equal(sizedImage(cdn, 400), "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/a.webp?v=1792934111&width=400");
assert.equal(sizedImage(`${cdn}&width=1200`, 600), "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/a.webp?v=1792934111&width=600");
assert.equal(imageSrcSet(cdn), `${sizedImage(cdn, 400)} 400w, ${sizedImage(cdn, 600)} 600w, ${sizedImage(cdn, 800)} 800w`);
// Other hosts (local files, Supabase storage, approved uploads) are untouched.
for (const u of ["/images/hero.webp", "https://xyz.supabase.co/storage/v1/object/public/m/a.webp", "http://cdn.shopify.com/a.png"]) {
  assert.equal(sizedImage(u, 400), u);
  assert.equal(imageSrcSet(u), undefined);
}
console.log("image-url tests passed");
