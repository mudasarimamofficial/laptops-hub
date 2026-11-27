import assert from "node:assert/strict";
import { cleanTags, guideFilterHref, hasGuideFilter, matchesGuideFilter, parseGuideFilter, postKicker } from "../../src/lib/content/blog";
import { articleJsonLd } from "../../src/lib/seo/content-jsonld";
import { articleSeoFromRow } from "../../src/lib/content/resolve";

// Label: category, else the starter template's label, else "Guide".
assert.equal(postKicker({ category: " Buying guides ", template_key: "howto" }), "Buying guides");
assert.equal(postKicker({ category: "", template_key: "product-review" }), "Review");
assert.equal(postKicker({ category: null, template_key: "unknown" }), "Guide");
assert.equal(postKicker({ category: "<b>x</b>" }), "b x /b", "no markup in labels");

// Tags: trimmed, case-insensitive de-duplication, max 20.
assert.deepEqual(cleanTags([" Dell ", "dell", "Battery", "", 5, null]), ["Dell", "Battery"]);
assert.equal(cleanTags(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 20);
assert.deepEqual(cleanTags("dell"), []);

// URL filter.
const f = parseGuideFilter({ category: ["Buying guides", "x"], tag: " battery " });
assert.deepEqual(f, { category: "Buying guides", tag: "battery" });
assert.equal(hasGuideFilter(parseGuideFilter({})), false);
assert.equal(hasGuideFilter(parseGuideFilter(undefined)), false);
assert.equal(parseGuideFilter({ tag: "x".repeat(200) }).tag.length, 40);
assert.equal(matchesGuideFilter({ category: "buying GUIDES", tags: ["Battery"] }, f), true);
assert.equal(matchesGuideFilter({ category: "Reviews", tags: ["Battery"] }, f), false);
assert.equal(matchesGuideFilter({ category: "Buying guides", tags: [] }, f), false);
assert.equal(matchesGuideFilter({ category: "", tags: [] }, null), true);
assert.equal(guideFilterHref({ tag: "a b&c" }), "/guides?tag=a+b%26c");
assert.equal(guideFilterHref({}), "/guides");

// Row → public article fields.
const seo = articleSeoFromRow({ slug: "x", title: "X", body_html: "<p>x</p>", status: "published", category: "Buying guides", tags: ["Dell", "dell", "Battery"], template_key: "news" })!;
assert.equal(seo.category, "Buying guides");
assert.deepEqual(seo.tags, ["Dell", "Battery"]);
assert.equal(seo.template, "news");

// Article markup: section/keywords only when set; news posts are NewsArticle.
const ORIGIN = "https://www.example.pk";
const ld = articleJsonLd(ORIGIN, "/guides/x", "T", "D", seo);
assert.equal(ld["@type"], "NewsArticle");
assert.equal(ld.articleSection, "Buying guides");
assert.equal(ld.keywords, "Dell, Battery");
const plainLd = articleJsonLd(ORIGIN, "/guides/x", "T", "D", { ...seo, category: "", tags: [], template: "standard" });
assert.equal(plainLd["@type"], "Article");
assert.equal("articleSection" in plainLd, false);
assert.equal("keywords" in plainLd, false);

console.log("blog-taxonomy.test.ts ok");
