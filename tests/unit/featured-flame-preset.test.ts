import assert from "node:assert/strict";
import {
  DEFAULT_FEATURED_FLAME_PRESET,
  FEATURED_FLAME_PRESET_NOTE,
  isPresetBadgeNote,
  parseFeaturedFlamePreset,
  selectFeaturedFlameCandidates,
  type PresetCandidate,
} from "../../src/lib/content/featured-flame-preset";
import { badgeLabel, buildBadgeMap, computeTopSellers, DEFAULT_SOCIAL_PROOF, type OrderActivityRow } from "../../src/lib/content/social-proof";

const now = new Date("2026-11-19T12:00:00+05:00");

function cand(partial: Partial<PresetCandidate> & Pick<PresetCandidate, "id" | "handle">): PresetCandidate {
  return {
    featured: false,
    sellable: true,
    updatedAt: "2026-11-01T00:00:00Z",
    category: "Laptop",
    ...partial,
  };
}

const homepage = [
  cand({ id: "11111111-1111-4111-8111-111111111111", handle: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage", updatedAt: "2026-11-10T00:00:00Z" }),
  cand({ id: "22222222-2222-4222-8222-222222222222", handle: "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage", updatedAt: "2026-11-09T00:00:00Z" }),
  cand({ id: "33333333-3333-4333-8333-333333333333", handle: "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage", updatedAt: "2026-11-08T00:00:00Z" }),
];

{
  const picks = selectFeaturedFlameCandidates(
    [
      cand({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", handle: "unsellable", sellable: false, featured: true }),
      cand({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", handle: "accessory-ssd", category: "Accessory", sellable: true, featured: true }),
      cand({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", handle: "featured-a", featured: true, updatedAt: "2026-11-18T00:00:00Z" }),
      cand({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", handle: "featured-b", featured: true, updatedAt: "2026-11-17T00:00:00Z" }),
      ...homepage,
      cand({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", handle: "filler-1", updatedAt: "2026-11-05T00:00:00Z" }),
      cand({ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", handle: "filler-2", updatedAt: "2026-11-04T00:00:00Z" }),
    ],
    6,
  );
  assert.equal(picks.length, 6);
  assert.deepEqual(
    picks.map((p) => p.handle),
    ["featured-a", "featured-b", "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage", "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage", "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage", "filler-1"],
  );
  assert.ok(!picks.some((p) => p.handle === "unsellable"), "draft/unsellable never selected");
  assert.ok(!picks.some((p) => p.handle === "accessory-ssd"), "accessories never selected");
}

{
  const picks = selectFeaturedFlameCandidates(homepage, 6);
  assert.equal(picks.length, 3, "fewer than target when catalog is small");
}

{
  assert.equal(isPresetBadgeNote(FEATURED_FLAME_PRESET_NOTE), true);
  assert.equal(isPresetBadgeNote("merchant note"), false);
  assert.deepEqual(parseFeaturedFlamePreset(null).enabled, true);
  assert.equal(parseFeaturedFlamePreset({ enabled: false, label: "  Hot  ", icon: "star" }).label, "Hot");
  assert.equal(parseFeaturedFlamePreset({ enabled: false, label: "  Hot  ", icon: "star" }).icon, "star");
  assert.equal(parseFeaturedFlamePreset({ enabled: false }).enabled, false);
  assert.equal(DEFAULT_FEATURED_FLAME_PRESET.icon, "flame");
}

{
  // Top Seller never fabricated from editorial featured rows.
  const on = { ...DEFAULT_SOCIAL_PROOF, topSeller: { ...DEFAULT_SOCIAL_PROOF.topSeller, enabled: true, minUnits: 3 } };
  const rows: OrderActivityRow[] = [];
  assert.deepEqual(computeTopSellers(rows, on, now), []);
  const map = buildBadgeMap([], [{ handle: "a", kind: "featured", startsAt: null, endsAt: null, note: FEATURED_FLAME_PRESET_NOTE }], on, now);
  assert.deepEqual(map, { a: { kind: "featured" } });
  assert.equal(badgeLabel({ kind: "featured", label: "Featured", icon: "flame" }), "Featured");
  assert.equal(badgeLabel({ kind: "top_seller" }), "Top seller");
}

console.log("featured-flame-preset.test.ts: ok");
