import assert from "node:assert/strict";
import {
  DEFAULT_THEME_GLOBALS,
  GLOBAL_COPY,
  GLOBAL_COPY_GROUPS,
  GLOBAL_COPY_PANELS,
  panelFields,
  withBrand,
  cleanGlobalsForSave,
  globalsFromThemeSettings,
  isDefaultGlobal,
  themeGlobals,
  themeGlobalsProblems,
} from "../../src/lib/content/theme-globals";
import { DEFAULT_TITLE_TEMPLATE, parseTitleSuffix, titleTemplate } from "../../src/lib/content/seo-defaults";
import { draftFingerprint, draftStateFingerprint } from "../../src/lib/content/theme-draft-fingerprint";

// Defaults reproduce the approved V5 chrome text exactly.
assert.equal(DEFAULT_THEME_GLOBALS.laptopsMenuLabel, "Laptops");
assert.equal(DEFAULT_THEME_GLOBALS.searchLabel, "Search model, processor, RAM");
assert.equal(DEFAULT_THEME_GLOBALS.searchShortLabel, "Search laptops");
assert.equal(DEFAULT_THEME_GLOBALS.menuAllLabel, "View all products");
assert.equal(DEFAULT_THEME_GLOBALS.menuSecondLabel, "Chromebooks");
assert.equal(DEFAULT_THEME_GLOBALS.menuSecondHref, "/collections/chromebooks");
assert.equal(DEFAULT_THEME_GLOBALS.footerTagline, "Used Dell, HP and Lenovo laptops. Prices in PKR. Visit us in Bahawalpur or shop online.");
assert.equal(DEFAULT_THEME_GLOBALS.footerContactHeading, "Visit & contact");
assert.equal(DEFAULT_THEME_GLOBALS.footerWhatsappLabel, "Chat on WhatsApp");
assert.equal(DEFAULT_THEME_GLOBALS.announcementCtaLabel, "Shop now");
assert.equal(DEFAULT_THEME_GLOBALS.announcementHref, "/collections/all");
assert.equal(new Set(GLOBAL_COPY.map((f) => f.key)).size, GLOBAL_COPY.length, "unique keys");
// P7: cart page, cart panel and compare page defaults equal the V5 text they replace (byte-identical storefront).
assert.equal(DEFAULT_THEME_GLOBALS.cartTitle, "Cart");
assert.equal(DEFAULT_THEME_GLOBALS.cartEmptyTitle, "Your cart is empty");
assert.equal(DEFAULT_THEME_GLOBALS.cartEmptyButton, "Browse the catalog");
assert.equal(DEFAULT_THEME_GLOBALS.cartEmptyHref, "/collections/all");
assert.equal(DEFAULT_THEME_GLOBALS.cartSummaryTitle, "Summary");
assert.equal(DEFAULT_THEME_GLOBALS.cartViewButton, "View cart");
assert.equal(DEFAULT_THEME_GLOBALS.cartOpenNote, "Prices, delivery and the order total are confirmed at checkout.");
assert.equal(DEFAULT_THEME_GLOBALS.cartClosedNote, "Online checkout is not open yet. Your cart is saved on this device.");
assert.equal(DEFAULT_THEME_GLOBALS.drawerOpenNote, "Prices are confirmed at checkout");
assert.equal(DEFAULT_THEME_GLOBALS.drawerClosedNote, "Online checkout is not open yet");
assert.equal(DEFAULT_THEME_GLOBALS.compareTitle, "Compare laptops");
assert.equal(DEFAULT_THEME_GLOBALS.compareSub, "Up to 4 at a time. Highlighted rows differ.");
assert.equal(DEFAULT_THEME_GLOBALS.compareEmptyTitle, "Nothing to compare yet");
assert.equal(DEFAULT_THEME_GLOBALS.compareEmptyText, "Tap Compare on any laptop card or product page.");
assert.equal(DEFAULT_THEME_GLOBALS.compareEmptyButton, "Browse laptops");
assert.equal(DEFAULT_THEME_GLOBALS.compareEmptyHref, "/collections/all");
assert.ok(GLOBAL_COPY_PANELS.some((p) => p.id === "cartCompare"));
assert.equal(themeGlobals({ cartEmptyHref: "javascript:alert(1)" }).cartEmptyHref, "/collections/all", "unsafe link falls back");

// Reading theme_settings: only a plain `globals` object counts.
assert.deepEqual(globalsFromThemeSettings(null), {});
assert.deepEqual(globalsFromThemeSettings([]), {});
assert.deepEqual(globalsFromThemeSettings({ globals: "x" }), {});
assert.deepEqual(globalsFromThemeSettings({ globals: [1] }), {});
assert.deepEqual(globalsFromThemeSettings({ globals: { footerTagline: "Hi" } }), { footerTagline: "Hi" });

// Overrides: trimmed, capped, unsafe links and non-strings fall back, unknown keys ignored.
const g = themeGlobals({
  footerTagline: "  Open 7 days.  ",
  announcementHref: "javascript:alert(1)",
  menuSecondHref: "/collections/gaming-laptops",
  laptopsMenuLabel: 5,
  searchLabel: "x".repeat(99),
  injected: "<b>",
});
assert.equal(g.footerTagline, "Open 7 days.");
assert.equal(g.announcementHref, "/collections/all");
assert.equal(g.menuSecondHref, "/collections/gaming-laptops");
assert.equal(g.laptopsMenuLabel, "Laptops");
assert.equal(g.searchLabel.length, 40);
assert.ok(!("injected" in g));
assert.ok(isDefaultGlobal(g, "menuAllLabel"));
assert.ok(!isDefaultGlobal(g, "menuSecondHref"));

// Save-time validation.
assert.deepEqual(themeGlobalsProblems(undefined), []);
assert.deepEqual(themeGlobalsProblems({ footerTagline: "", menuAllLabel: "All", announcementHref: "   " }), []);
const probs = themeGlobalsProblems({ announcementHref: "http://x.com", footerContactHeading: 3, footerWhatsappLabel: "w".repeat(41) });
assert.equal(probs.length, 3, probs.join(" | "));
assert.ok(probs.every((p) => p.startsWith("Header & footer → ")));

// cleanGlobalsForSave keeps only known non-empty strings (trimmed).
assert.deepEqual(cleanGlobalsForSave({ footerTagline: " A ", menuAllLabel: "", evil: "x", searchLabel: 3 }), { footerTagline: "A" });

// SEO title suffix → template.
assert.equal(parseTitleSuffix(null), "");
assert.equal(parseTitleSuffix({ title_suffix: "" }), "");
assert.equal(parseTitleSuffix({ title_suffix: "  | Laptops HUB \n" }), "| Laptops HUB");
assert.equal(parseTitleSuffix({ title_suffix: 7 }), "");
assert.equal(parseTitleSuffix({ title_suffix: "y".repeat(120) }).length, 80);
assert.equal(titleTemplate(""), DEFAULT_TITLE_TEMPLATE);
assert.equal(DEFAULT_TITLE_TEMPLATE, "%s · Laptops HUB");
assert.equal(titleTemplate("| Laptops HUB"), "%s | Laptops HUB");

// Draft fingerprint stays compatible when theme_settings is empty; changes when globals change.
const secs = [{ id: "hero", settings: {} }];
assert.equal(draftStateFingerprint(secs, {}), draftFingerprint(secs));
assert.equal(draftStateFingerprint(secs, null), draftFingerprint(secs));
assert.notEqual(draftStateFingerprint(secs, { globals: { footerTagline: "A" } }), draftFingerprint(secs));
assert.notEqual(
  draftStateFingerprint(secs, { globals: { footerTagline: "A" } }),
  draftStateFingerprint(secs, { globals: { footerTagline: "B" } }),
);

// Phase 2b: page templates — defaults equal the V5 text.
assert.equal(DEFAULT_THEME_GLOBALS.pdpSpecHeading, "Specifications");
assert.equal(DEFAULT_THEME_GLOBALS.pdpAboutHeading, "About this listing");
assert.equal(DEFAULT_THEME_GLOBALS.pdpRelatedHeading, "More from {brand}");
assert.equal(DEFAULT_THEME_GLOBALS.pdpPolicyCta, "READ POLICY");
assert.equal(DEFAULT_THEME_GLOBALS.colNoResultsHeading, "No products match these filters");
assert.equal(DEFAULT_THEME_GLOBALS.colLoadMore, "Load more");
assert.equal(DEFAULT_THEME_GLOBALS.nfTitle, "This page doesn’t exist");
assert.equal(DEFAULT_THEME_GLOBALS.nfProductTitle, "This product isn’t in the catalog");
assert.equal(DEFAULT_THEME_GLOBALS.nfButtonHref, "/collections/all");
assert.equal(withBrand("More from {brand}", "Dell"), "More from Dell");
assert.equal(withBrand("{brand} & {brand}", "HP"), "HP & HP");
assert.equal(withBrand("Related", "HP"), "Related");
// Every field belongs to exactly one panel; panels cover all fields.
const covered = GLOBAL_COPY_PANELS.flatMap((p) => panelFields(p.id).map((f) => f.key));
assert.equal(covered.length, GLOBAL_COPY.length);
assert.equal(new Set(covered).size, GLOBAL_COPY.length);
for (const f of GLOBAL_COPY) assert.ok(GLOBAL_COPY_GROUPS.some((g) => g.id === f.group), `group for ${f.key}`);
// Problems are labelled with the panel the merchant sees.
const p2 = themeGlobalsProblems({ nfButtonHref: "ftp://x", pdpSpecHeading: "s".repeat(61) });
assert.equal(p2.length, 2, p2.join(" | "));
assert.ok(p2.some((m) => m.startsWith("Page not found → Button goes to")));
assert.ok(p2.some((m) => m.startsWith("Product pages → Specifications: heading")));
// Overrides resolve for templates too.
assert.equal(themeGlobals({ colLoadMore: " Show more " }).colLoadMore, "Show more");

console.log("theme-globals: ok");
