import assert from "node:assert/strict";
import { isActiveOwnerEmail, OWNER_EMAIL } from "../../src/lib/auth/owner-identity";
import { presetToDraftReel, REELS_PRESET_KEYS } from "../../src/lib/content/reels-presets";
import { readFileSync } from "node:fs";
import { join } from "node:path";

assert.equal(OWNER_EMAIL, "infolaptopshub@gmail.com");
assert.equal(isActiveOwnerEmail(OWNER_EMAIL), true);
assert.equal(isActiveOwnerEmail("InfoLaptopsHub@gmail.com"), true);
assert.equal(isActiveOwnerEmail("laptopshubofficial@gmail.com"), false);
assert.equal(isActiveOwnerEmail(null), false);

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "data", "reels-presets-manifest.json"), "utf8"),
) as { presets: Array<Parameters<typeof presetToDraftReel>[0]> };

assert.equal(manifest.presets.length, 6);
assert.deepEqual(
  manifest.presets.map((p) => p.key),
  [...REELS_PRESET_KEYS],
);

for (const p of manifest.presets) {
  assert.ok(p.videoUrl?.includes("ronin.pk"), `preset ${p.key} needs real video URL`);
  assert.ok(!p.videoUrl?.includes("cdn.example.com"), `preset ${p.key} must not use fake CDN`);
  const row = presetToDraftReel(p);
  assert.equal(row.status, "draft");
  assert.equal(row.rights_status, "pending");
  assert.equal(row.preset_key, p.key);
  assert.equal(row.media_source, p.hlsUrl ? "external_stream" : "external_file");
  assert.equal(row.creator_consent, false);
  assert.equal(row.creator_name, "");
}
