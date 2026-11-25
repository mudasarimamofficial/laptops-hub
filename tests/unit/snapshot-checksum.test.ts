import assert from "node:assert/strict";
import { canonicalJson, checksumPayload, checksumVerdict } from "../../src/lib/admin/merchant-snapshots";
import { createHash } from "crypto";

// Postgres jsonb stores object keys sorted by length, then bytes. Simulate that reordering at every level.
const jsonbOrder = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(jsonbOrder);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(keys.map((k) => [k, jsonbOrder(o[k])]));
  }
  return v;
};

const payload = {
  schemaVersion: 2,
  capturedAt: "2026-11-25T10:00:00.000Z",
  store_settings: [{ key: "cod_checkout", value: { enabled: true, note: "ü" }, updated_at: null }],
  articles: [],
  reels: [{ id: "r1", sort_order: 1, tags: ["a", "b"], extra: undefined }],
  store_testimonials: [],
  shipping_zones: [{ id: "z", flat_fee_paisa: 0 }],
};
const stored = JSON.parse(JSON.stringify(jsonbOrder(payload)));
assert.notEqual(JSON.stringify(stored), JSON.stringify(payload), "the simulated storage really reorders keys");
assert.equal(canonicalJson(stored), canonicalJson(payload));

const sum = checksumPayload(payload);
assert.match(sum, /^c1:[0-9a-f]{64}$/);
assert.equal(checksumVerdict(sum, stored), "ok", "verifies after jsonb storage (the old checksum never did)");
assert.equal(checksumVerdict(sum, { ...stored, articles: [{ id: "x" }] }), "mismatch");
const legacy = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
assert.equal(checksumVerdict(legacy, stored), "legacy");
assert.equal(checksumVerdict(null, stored), "ok");

console.log("snapshot-checksum: ok");
