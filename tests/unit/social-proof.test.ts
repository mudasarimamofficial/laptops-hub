import assert from "node:assert/strict";
import {
  activityText,
  buildActivityItems,
  buildBadgeMap,
  computeTopSellers,
  DEFAULT_SOCIAL_PROOF,
  editorialBadgeInputSchema,
  parseSocialProof,
  socialProofSchema,
  timeBucket,
  type OrderActivityRow,
  type SocialProofSettings,
} from "../../src/lib/content/social-proof";
import { displayTag, reelInputSchema } from "../../src/lib/content/reels";

const now = new Date("2026-11-14T15:00:00+05:00");
const on: SocialProofSettings = {
  ...DEFAULT_SOCIAL_PROOF,
  activity: { ...DEFAULT_SOCIAL_PROOF.activity, enabled: true },
  topSeller: { ...DEFAULT_SOCIAL_PROOF.topSeller, enabled: true, minUnits: 3 },
};
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const row = (o: Partial<OrderActivityRow>): OrderActivityRow => ({
  orderId: "o1",
  status: "confirmed",
  createdAt: hoursAgo(1),
  city: "LAHORE",
  productId: "p1",
  handle: "hp-840-g8",
  title: "HP EliteBook 840 G8",
  quantity: 1,
  ...o,
});

// Defaults: everything that could look like social proof is OFF
assert.equal(DEFAULT_SOCIAL_PROOF.activity.enabled, false);
assert.equal(DEFAULT_SOCIAL_PROOF.topSeller.enabled, false);
assert.deepEqual(parseSocialProof(null), DEFAULT_SOCIAL_PROOF);
assert.deepEqual(parseSocialProof("garbage"), DEFAULT_SOCIAL_PROOF);
// A malformed value never switches a feature on; valid fields survive independently.
const tolerant = parseSocialProof({ activity: { enabled: "yes", windowDays: 7 }, topSeller: { enabled: 1, minUnits: 0 } });
assert.equal(tolerant.activity.enabled, false);
assert.equal(tolerant.activity.windowDays, 7);
assert.equal(tolerant.topSeller.enabled, false);
assert.equal(tolerant.topSeller.minUnits, DEFAULT_SOCIAL_PROOF.topSeller.minUnits, "minUnits below 2 rejected");
// No demo / test-data switch exists: unknown keys are stripped.
assert.equal(Object.keys(socialProofSchema.shape.activity.shape).some((k) => /demo|test|fake/i.test(k)), false);
const stripped = socialProofSchema.parse({ ...on, activity: { ...on.activity, demo: true } });
assert.equal("demo" in stripped.activity, false);

// Zero orders => zero notices and zero top sellers
assert.deepEqual(buildActivityItems([], on, {}, now), []);
assert.deepEqual(computeTopSellers([], on, now), []);
// Feature off => nothing even with real orders.
assert.deepEqual(buildActivityItems([row({})], DEFAULT_SOCIAL_PROOF, {}, now), []);
assert.deepEqual(computeTopSellers([row({ quantity: 9 })], DEFAULT_SOCIAL_PROOF, now), []);

// Only qualifying statuses count
for (const status of ["placed", "pending_confirmation", "cancelled", "delivery_failed", "returned", "return_requested"]) {
  assert.deepEqual(buildActivityItems([row({ status })], on, {}, now), [], `${status} never shown`);
  assert.deepEqual(computeTopSellers([row({ status, quantity: 10 })], on, now), [], `${status} never counted`);
}
const deliveredOnly = { ...on, activity: { ...on.activity, minStatus: "delivered" as const } };
assert.deepEqual(buildActivityItems([row({ status: "shipped" })], deliveredOnly, {}, now), []);
assert.equal(buildActivityItems([row({ status: "delivered" })], deliveredOnly, {}, now).length, 1);

// Privacy: payload has no ids, names, phones, addresses, quantities or exact times
const items = buildActivityItems([row({ quantity: 4 })], on, { "hp-840-g8": "https://cdn.example.com/a.webp" }, now);
assert.equal(items.length, 1);
assert.deepEqual(Object.keys(items[0]).sort(), ["city", "handle", "imageUrl", "title", "when"]);
assert.equal(items[0].city, null, "city hidden by default");
assert.equal(items[0].when, "today");
assert.equal(activityText(items[0]), "A customer ordered HP EliteBook 840 G8 today");
assert.equal(/paid|bought|purchased/i.test(activityText(items[0])), false, "COD copy never claims payment");
const withCity = buildActivityItems([row({})], { ...on, activity: { ...on.activity, showCity: true } }, {}, now);
assert.equal(activityText(withCity[0]), "A customer in Lahore ordered HP EliteBook 840 G8 today");

// Window, future timestamps, de-duplication, limit
assert.deepEqual(buildActivityItems([row({ createdAt: hoursAgo(24 * 15) })], on, {}, now), [], "outside 14-day window");
assert.deepEqual(buildActivityItems([row({ createdAt: hoursAgo(-2) })], on, {}, now), [], "future timestamp refused");
const dup = buildActivityItems(
  [row({ orderId: "a" }), row({ orderId: "b" }), row({ orderId: "a", handle: "dell-7490", title: "Dell 7490" })],
  on,
  {},
  now,
);
assert.equal(dup.length, 1, "one notice per product and per order");
const many = Array.from({ length: 9 }, (_, i) => row({ orderId: `o${i}`, handle: `h${i}`, title: `T${i}` }));
assert.equal(buildActivityItems(many, on, {}, now).length, 5);

// Coarse time buckets
assert.equal(timeBucket(hoursAgo(1), now), "today");
assert.equal(timeBucket(hoursAgo(20), now), "yesterday");
assert.equal(timeBucket(hoursAgo(24 * 4), now), "this_week");
assert.equal(timeBucket(hoursAgo(24 * 10), now), "recently");

// Top sellers: real units, threshold, ranking, cap
const sales = [
  row({ orderId: "1", handle: "a", quantity: 2 }),
  row({ orderId: "2", handle: "a", quantity: 1 }),
  row({ orderId: "3", handle: "b", quantity: 5 }),
  row({ orderId: "4", handle: "c", quantity: 2 }),
  row({ orderId: "5", handle: "c", quantity: 9, status: "cancelled" }),
  row({ orderId: "6", handle: "d", quantity: 7, createdAt: hoursAgo(24 * 40) }),
];
assert.deepEqual(computeTopSellers(sales, on, now), ["b", "a"]);
assert.deepEqual(computeTopSellers(sales, { ...on, topSeller: { ...on.topSeller, maxProducts: 1 } }, now), ["b"]);
assert.deepEqual(computeTopSellers([row({ quantity: -5 }), row({ quantity: 2.5 })], on, now), [], "bad quantities ignored");

// Badge map: data-backed wins, editorial scheduled, global switch
const editorial = [
  { handle: "a", kind: "featured", startsAt: null, endsAt: null },
  { handle: "x", kind: "popular_pick", startsAt: hoursAgo(-5), endsAt: null },
  { handle: "y", kind: "staff_pick", startsAt: null, endsAt: hoursAgo(1) },
  { handle: "z", kind: "top_seller", startsAt: null, endsAt: null },
];
assert.deepEqual(buildBadgeMap(["a"], editorial, on, now), { a: { kind: "top_seller" } }, "future, expired and forged editorial rows dropped");
assert.deepEqual(buildBadgeMap([], editorial.slice(0, 1), on, now), { a: { kind: "featured" } });
assert.deepEqual(buildBadgeMap([], editorial.slice(0, 1), { ...on, editorial: { enabled: false } }, now), {});

// Editorial input cannot carry a sales claim
assert.equal(editorialBadgeInputSchema.safeParse({ productHandle: "hp-840-g8", kind: "featured" }).success, true);
assert.equal(editorialBadgeInputSchema.safeParse({ productHandle: "hp-840-g8", kind: "top_seller" }).success, false);
assert.equal(
  editorialBadgeInputSchema.safeParse({ productHandle: "hp-840-g8", kind: "featured", startsAt: "2026-11-20T00:00:00Z", endsAt: "2026-11-19T00:00:00Z" }).success,
  false,
);
assert.equal(editorialBadgeInputSchema.safeParse({ productHandle: "../etc", kind: "featured" }).success, false);

// Reel creator consent and tag
const reel = { title: "Unboxing", videoUrl: "https://cdn.example.com/a.mp4", rightsStatus: "owned", status: "published" };
assert.equal(reelInputSchema.safeParse({ ...reel, creatorName: "Ali" }).success, false, "named creator needs consent");
assert.equal(reelInputSchema.safeParse({ ...reel, creatorName: "Ali", creatorConsent: true }).success, true);
assert.equal(reelInputSchema.safeParse({ ...reel, tag: "#Productivity" }).success, true);
assert.equal(reelInputSchema.safeParse({ ...reel, tag: "<script>" }).success, false);
assert.equal(displayTag("productivity"), "#productivity");
assert.equal(displayTag(""), "");

console.log("social-proof tests passed");
