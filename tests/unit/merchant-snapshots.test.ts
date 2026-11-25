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

const emptyZones = { ...base(), shipping_zones: [] };
assert.equal(validateSnapshotPayload(emptyZones).ok, false);

const p = base();
const sum = checksumPayload(p);
// LH-036: canonical (key-sorted) JSON, so the checksum still matches after jsonb storage reorders keys.
assert.equal(sum, `c1:${createHash("sha256").update(canonicalJson(p)).digest("hex")}`);
assert.equal(checksumPayload(Object.fromEntries(Object.entries(p).reverse())), sum);
assert.notEqual(checksumPayload({ ...p, articles: [] }), sum);

console.log("merchant-snapshots.test.ts: ok");
