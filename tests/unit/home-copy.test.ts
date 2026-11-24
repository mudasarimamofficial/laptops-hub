import assert from "node:assert/strict";
import { HOME_COPY, copyFields, homeCopy, homeCopyProblems, isDefaultCopy, isSafeCopyHref } from "../../src/lib/content/home-copy";
import { SECTION_REGISTRY, V5_HOMEPAGE_SECTIONS } from "../../src/lib/content/site-builder-schema";
import { homeSectionSettingProblems } from "../../src/lib/content/home-sections";
import { draftFingerprint } from "../../src/lib/content/theme-draft-fingerprint";

// Every renderable V5 section except reviews/map (own settings) has merchant copy.
for (const s of V5_HOMEPAGE_SECTIONS) {
  if (s.type === "v5_store_reviews" || s.type === "v5_store_map") continue;
  assert.ok(copyFields(s.type).length > 0, `${s.type} has editable copy`);
}

// Defaults reproduce the approved V5 text exactly (no layout = original page).
const hero = homeCopy("v5_cinematic_hero");
assert.equal(hero.headingLine1, "The future of");
assert.equal(hero.headingAccent, "smarter laptop");
assert.equal(hero.headingLine3, "shopping.");
assert.equal(hero.primaryHref, "/collections/all");
assert.equal(hero.secondaryHref, "#brands");
assert.equal(homeCopy("v5_home_inquiry").heading, "Tell us what you're looking for.");
assert.equal(homeCopy("v5_compare_demo").heading, "Compare before you buy.");
assert.equal(homeCopy("v5_brand_grid").heading, "Shop by brand");

// Overrides apply; empty, non-string and unknown keys fall back / are ignored.
const custom = homeCopy("v5_cinematic_hero", {
  headingLine1: "  Eid sale on ",
  headingAccent: "",
  intro: 42,
  primaryLabel: "Shop the sale",
  primaryHref: "/collections/gen-10-plus",
  secondaryHref: "javascript:alert(1)",
  injected: "<script>",
});
assert.equal(custom.headingLine1, "Eid sale on", "trimmed override");
assert.equal(custom.headingAccent, "smarter laptop", "empty → default");
assert.equal(custom.intro, hero.intro, "non-string → default");
assert.equal(custom.primaryLabel, "Shop the sale");
assert.equal(custom.primaryHref, "/collections/gen-10-plus");
assert.equal(custom.secondaryHref, "#brands", "unsafe link → default");
assert.ok(!("injected" in custom), "unknown keys ignored");

// Length cap and control characters.
const long = homeCopy("v5_brand_grid", { heading: "x".repeat(500) + "\u0000" });
assert.equal(long.heading.length, 120);
assert.equal(homeCopy("v5_brand_grid", { heading: "Brands\u0007" }).heading, "Brands");

// Link safety.
for (const ok of ["/collections/all", "/pages/about?x=1", "#brands", "https://www.laptopshub.pk/x", "tel:+923093372974", "mailto:infolaptopshub@gmail.com"])
  assert.ok(isSafeCopyHref(ok), `safe: ${ok}`);
for (const bad of ["javascript:alert(1)", "data:text/html,x", "http://example.com", "//evil.com", "/\\evil.com", "collections", "# x", "", " /a b", "https://", 5])
  assert.ok(!isSafeCopyHref(bad), `unsafe: ${String(bad)}`);

// Save-time validation reports bad links and over-long text; empty values are fine.
const problems = homeCopyProblems([
  { type: "v5_cinematic_hero", label: "Hero", settings: { primaryHref: "javascript:x", headingLine1: "y".repeat(61), intro: "" } },
  { type: "v5_brand_grid", settings: { heading: 7 } },
  { type: "v5_store_map", settings: { heading: "anything" } },
]);
assert.equal(problems.length, 3, problems.join(" | "));
assert.ok(problems.some((p) => p.startsWith("Hero → Main button link")));
assert.ok(homeSectionSettingProblems([{ type: "v5_promo", settings: { ctaLabel: "ok" } }]).length === 0);

// isDefaultCopy drives the "count" button text.
assert.ok(isDefaultCopy("v5_featured_products", {}, "ctaLabel"));
assert.ok(!isDefaultCopy("v5_featured_products", { ctaLabel: "See all" }, "ctaLabel"));

// Registry exposes copy fields first, marked as copy, with their defaults.
for (const [type, fields] of Object.entries(HOME_COPY)) {
  const reg = SECTION_REGISTRY[type as keyof typeof SECTION_REGISTRY].fields;
  fields!.forEach((f, i) => {
    assert.equal(reg[i].key, f.key);
    assert.equal(reg[i].copy, true);
    assert.equal(reg[i].defaultText, f.default);
  });
}
// Existing image fields remain after copy fields.
assert.ok(SECTION_REGISTRY.v5_cinematic_hero.fields.some((f) => f.key === "mainImageUrl"));

// Draft fingerprint: stable for equal content, different for changed content, "none" when absent.
const a = [{ id: "hero", settings: { headingLine1: "A" } }];
assert.equal(draftFingerprint(a), draftFingerprint(JSON.parse(JSON.stringify(a))));
assert.notEqual(draftFingerprint(a), draftFingerprint([{ id: "hero", settings: { headingLine1: "B" } }]));
assert.equal(draftFingerprint(null), "none");

console.log("home-copy: ok");
