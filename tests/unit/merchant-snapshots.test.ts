import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SNAPSHOT_SCOPE,
  validateSnapshotPayload,
  checksumPayload,
  canonicalJson,
  type MerchantCmsPayload,
} from "../../src/lib/admin/merchant-snapshots";

const base = (): MerchantCmsPayload => ({
  schemaVersion: 2,
  capturedAt: new Date().toISOString(),
  store_settings: [{ key: "cod_checkout", value: { enabled: true } }],
  articles: [{ id: "11111111-1111-1111-1111-111111111111", title: "A" }],
  reels: [],
  store_testimonials: [],
  shipping_zones: [{ id: "22222222-2222-2222-2222-222222222222", name: "All Over PK" }],
});

assert.deepEqual([...SNAPSHOT_SCOPE], [
  "store_settings",
  "articles",
  "reels",
  "store_testimonials",
  "shipping_zones",
  "content_pages",
  "reel_products",
  "theme",
]);

assert.equal(validateSnapshotPayload(null).ok, false);
assert.equal(validateSnapshotPayload({}).ok, false);
assert.equal(validateSnapshotPayload(base()).ok, true);

const legacy = {
  ...base(),
  products: [{ id: "x" }],
  product_variants: [{ id: "y" }],
};
assert.equal(validateSnapshotPayload(legacy).ok, false);
assert.equal(validateSnapshotPayload(legacy).reason, "legacy_catalog_payload_unsupported");

// G17 v3: the extra sections are required once the payload says version 3; version 2 backups stay valid without them.
const v3 = { ...base(), schemaVersion: 3, content_pages: [{ slug: "about" }], reel_products: [], theme: { publications: [], versions: [] } };
assert.equal(validateSnapshotPayload(v3).ok, true);
assert.equal(validateSnapshotPayload(v3).checks.content_pages, 1);
const v3Missing = { ...v3, reel_products: undefined };
assert.equal(validateSnapshotPayload(v3Missing).ok, false);
assert.equal(validateSnapshotPayload(v3Missing).reason, "missing_v3_sections");
assert.equal(validateSnapshotPayload({ ...v3, theme: { publications: [] } }).reason, "missing_v3_sections");

const emptyZones = { ...base(), shipping_zones: [] };
assert.equal(validateSnapshotPayload(emptyZones).ok, false);

const p = base();
const sum = checksumPayload(p);
// LH-036: canonical (key-sorted) JSON, so the checksum still matches after jsonb storage reorders keys.
assert.equal(sum, `c1:${createHash("sha256").update(canonicalJson(p)).digest("hex")}`);
assert.equal(checksumPayload(Object.fromEntries(Object.entries(p).reverse())), sum);
assert.notEqual(checksumPayload({ ...p, articles: [] }), sum);

console.log("merchant-snapshots.test.ts: ok");
