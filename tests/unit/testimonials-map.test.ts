import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canTransition,
  formatReviewDate,
  initials,
  splitRows,
  testimonialInputSchema,
  toRow,
} from "../../src/lib/content/testimonials";
import {
  STORE_MAP_EMBED_SRC,
  STORE_MAPS_URL,
  homeSectionSettingProblems,
  isSafeEmbedSrc,
  isSafeMapsUrl,
  mapSettings,
  reviewsSettings,
} from "../../src/lib/content/home-sections";
import { V5_HOMEPAGE_SECTIONS, withLaterSections } from "../../src/lib/content/site-builder-schema";

const base = { authorName: "Ali Raza", body: "Bought a ThinkPad, works great and the team was honest.", source: "merchant" as const };

// --- Input validation and provenance -------------------------------------------------------------
assert.equal(testimonialInputSchema.safeParse(base).success, true);
const g1 = testimonialInputSchema.safeParse({ ...base, source: "google" });
assert.equal(g1.success, false, "google source without a link is refused");
assert.ok(!g1.success && g1.error.issues.some((i) => i.path[0] === "sourceUrl"));
assert.equal(testimonialInputSchema.safeParse({ ...base, source: "google", sourceUrl: "https://evil.example/maps" }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, source: "google", sourceUrl: "https://maps.app.goo.gl/abc123" }).success, true);
assert.equal(testimonialInputSchema.safeParse({ ...base, source: "google", sourceUrl: "https://www.google.com/maps/reviews/x" }).success, true);
assert.equal(testimonialInputSchema.safeParse({ ...base, avatarUrl: "https://cdn.example/a.jpg" }).success, false, "avatar needs permission");
assert.equal(testimonialInputSchema.safeParse({ ...base, avatarUrl: "https://cdn.example/a.jpg", avatarPermission: true }).success, true);
assert.equal(testimonialInputSchema.safeParse({ ...base, avatarUrl: "javascript:alert(1)", avatarPermission: true }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, avatarUrl: "http://plain.example/a.jpg", avatarPermission: true }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, reviewDate: "2999-01-01" }).success, false, "no future dates");
assert.equal(testimonialInputSchema.safeParse({ ...base, rating: 6 }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, rating: 0 }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, body: "short" }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, body: "x".repeat(2001) }).success, false);
assert.equal(testimonialInputSchema.safeParse({ ...base, source: "yelp" }).success, false);
// HTML is accepted as text (rendered by React as text, never as markup) — stored verbatim.
const html = testimonialInputSchema.parse({ ...base, body: "<img src=x onerror=alert(1)> great shop" });
assert.equal(toRow(html).body, "<img src=x onerror=alert(1)> great shop");
// Avatar permission is cleared when no avatar is set.
assert.equal(toRow(testimonialInputSchema.parse({ ...base, avatarPermission: true })).avatar_permission, false);
assert.equal(toRow(testimonialInputSchema.parse(base)).review_date, null);

// --- Roles ----------------------------------------------------------------------------------------
assert.equal(canTransition("editor", "draft", "pending"), true);
assert.equal(canTransition("editor", "pending", "draft"), true);
assert.equal(canTransition("editor", "pending", "published"), false);
assert.equal(canTransition("editor", "published", "hidden"), false);
assert.equal(canTransition("editor", "hidden", "draft"), false);
assert.equal(canTransition("manager", "pending", "published"), true);
assert.equal(canTransition("owner", "published", "hidden"), true);
assert.equal(canTransition("support" as never, "draft", "pending"), false);

// --- Display helpers ------------------------------------------------------------------------------
assert.equal(initials("Muhammad Arslan"), "MA");
assert.equal(initials("ali"), "A");
assert.equal(initials("  "), "?");
assert.equal(formatReviewDate("2026-03-14"), "March 2026");
assert.equal(formatReviewDate(null), null);
assert.equal(formatReviewDate("not-a-date"), null);
assert.deepEqual(splitRows([1, 2, 3]), [[1, 2, 3]]);
assert.deepEqual(splitRows([1, 2, 3, 4, 5, 6, 7]), [[1, 2, 3, 4], [5, 6, 7]]);

// --- Section settings: safe sources only ---------------------------------------------------------
assert.equal(isSafeEmbedSrc(STORE_MAP_EMBED_SRC), true, "supplied embed passes");
assert.equal(isSafeEmbedSrc("https://evil.example/maps/embed?pb=1"), false);
assert.equal(isSafeEmbedSrc("https://www.google.com/maps/embed?pb=1\"><script>"), false);
assert.equal(isSafeEmbedSrc("javascript:alert(1)"), false);
assert.equal(isSafeMapsUrl(STORE_MAPS_URL), true);
assert.equal(isSafeMapsUrl("https://google.com.evil.example/maps"), false);
const m = mapSettings({ embedSrc: "https://evil.example/x", mapsUrl: "javascript:1", heading: "  ", revealEffect: false });
assert.equal(m.embedSrc, STORE_MAP_EMBED_SRC);
assert.equal(m.mapsUrl, STORE_MAPS_URL);
assert.equal(m.heading, "Visit our store");
assert.equal(m.revealEffect, false);
assert.equal(m.clickToLoad, false);
const r = reviewsSettings({ placement: "nowhere", googleProfileUrl: "" });
assert.equal(r.placement, "before_inquiry");
assert.equal(r.googleProfileUrl, null, "owner can remove the profile link");
assert.equal(reviewsSettings({ placement: "after_compare" }).placement, "after_compare");
assert.equal(homeSectionSettingProblems([{ type: "v5_store_map", settings: { embedSrc: "https://evil.example" } }]).length, 1);
assert.equal(homeSectionSettingProblems([{ type: "v5_store_reviews", settings: { googleProfileUrl: "https://evil.example" } }]).length, 1);
assert.equal(homeSectionSettingProblems([{ type: "v5_store_map", settings: { embedSrc: STORE_MAP_EMBED_SRC } }]).length, 0);

// --- Registry: new sections present; older drafts gain them without losing their own --------------
const types = V5_HOMEPAGE_SECTIONS.map((s) => s.type);
assert.ok(types.includes("v5_store_reviews") && types.includes("v5_store_map"));
const old = V5_HOMEPAGE_SECTIONS.filter((s) => s.type !== "v5_store_reviews" && s.type !== "v5_store_map");
const upgraded = withLaterSections(old);
assert.equal(upgraded.length, old.length + 2);
assert.equal(withLaterSections(upgraded).length, upgraded.length, "idempotent");

// No aggregate rating or review count is hard-coded anywhere in these modules.
for (const mod of ["testimonials", "home-sections"]) {
  const src = readFileSync(`src/lib/content/${mod}.ts`, "utf8");
  assert.ok(!/4\.9|\b157\b/.test(src), `${mod} has no hard-coded rating/count`);
}

console.log("testimonials-map tests passed");
