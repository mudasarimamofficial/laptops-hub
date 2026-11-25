import assert from "node:assert/strict";
import { DEFAULT_CONTACT_SOCIAL } from "../../src/lib/content/contact-social";
import {
  DEFAULT_HOME_DESCRIPTION,
  DEFAULT_HOME_TITLE,
  cleanSeoText,
  homeSearchAppearance,
  parseSeoDefaults,
} from "../../src/lib/content/seo-defaults";
import { jsonLdScript, pkPhoneE164, postalAddress, siteAlternateNames, siteJsonLd } from "../../src/lib/seo/site-jsonld";
import { articleJsonLd, breadcrumbJsonLd } from "../../src/lib/seo/content-jsonld";
import { sharedSearchTitles } from "../../src/lib/seo/product-meta";

const ORIGIN = "https://www.laptopshub.pk";

// Phones: Pakistani local numbers become E.164; anything unclear is dropped (never guessed).
assert.equal(pkPhoneE164("03093372974"), "+923093372974");
assert.equal(pkPhoneE164("0313 6565663"), "+923136565663");
assert.equal(pkPhoneE164("+92 339 9100199"), "+923399100199");
assert.equal(pkPhoneE164("12345"), null);

// Address: "<name>, street…, City, Pakistan" becomes a postal address; other shapes stay plain text.
assert.deepEqual(postalAddress(DEFAULT_CONTACT_SOCIAL.address, "Laptops HUB"), {
  "@type": "PostalAddress",
  streetAddress: "1st Floor, Al Raheem Center Plaza, University Chowk",
  addressLocality: "Bahawalpur",
  addressCountry: "PK",
});
assert.equal(postalAddress("Somewhere in town", "Laptops HUB"), "Somewhere in town");
assert.equal(postalAddress("", "Laptops HUB"), null);

// Site names Google may use: the brand's own spellings and the domain.
assert.deepEqual(siteAlternateNames("Laptops HUB", "www.laptopshub.pk"), ["Laptops Hub", "LaptopsHUB", "laptopshub.pk"]);

// The business graph uses only Contact & Social facts: no ratings, hours, geo or price range; no SearchAction.
const ld = siteJsonLd(ORIGIN, DEFAULT_CONTACT_SOCIAL);
const [biz, site] = ld["@graph"] as Record<string, unknown>[];
assert.deepEqual(biz["@type"], ["Organization", "ComputerStore"]);
assert.equal(biz.name, "Laptops HUB");
assert.equal(biz.url, `${ORIGIN}/`);
assert.equal((biz.logo as { url: string }).url, `${ORIGIN}/brand/laptops-hub-logo-512.png`);
assert.equal(biz.telephone, "+923093372974");
assert.equal(biz.email, "infolaptopshub@gmail.com");
assert.equal((biz.contactPoint as unknown[]).length, 3);
assert.deepEqual(biz.sameAs, [
  "https://www.facebook.com/LaptopshubII.pk",
  "https://www.instagram.com/laptopshub.pk",
  "https://www.tiktok.com/@laptopshub.pk",
  "https://www.youtube.com/@Laptopshub",
]);
for (const k of ["aggregateRating", "review", "openingHours", "openingHoursSpecification", "geo", "priceRange"]) assert.equal(k in biz, false, k);
assert.equal(site["@type"], "WebSite");
assert.equal(site.name, "Laptops HUB");
assert.equal("potentialAction" in site, false);

// Disabled phones/socials and non-https social links are not published.
const trimmed = siteJsonLd(ORIGIN, {
  ...DEFAULT_CONTACT_SOCIAL,
  phones: DEFAULT_CONTACT_SOCIAL.phones.map((p, i) => ({ ...p, enabled: i === 1 })),
  social: [{ id: "facebook", label: "Facebook", url: "javascript:alert(1)", enabled: true }],
  email: "",
});
const tb = (trimmed["@graph"] as Record<string, unknown>[])[0];
assert.equal(tb.telephone, "+923136565663");
assert.equal("sameAs" in tb, false);
assert.equal("email" in tb, false);

// Script-safe JSON: a "</script>" in merchant text cannot close the element.
const unsafe = jsonLdScript(siteJsonLd(ORIGIN, { ...DEFAULT_CONTACT_SOCIAL, businessName: "X</script><script>alert(1)</script>" }));
assert.equal(unsafe.includes("</script>"), false);
assert.ok(unsafe.includes("\\u003c/script>"));

// Homepage search appearance: stored text wins; empty uses the brand + city defaults; text is plain and capped.
assert.deepEqual(homeSearchAppearance(parseSeoDefaults(null)), { title: DEFAULT_HOME_TITLE, description: DEFAULT_HOME_DESCRIPTION });
const custom = parseSeoDefaults({ title_suffix: "| Laptops HUB", home_title: "  Laptops HUB\n Bahawalpur ", home_description: "Shop\u0000 laptops" });
assert.equal(custom.titleSuffix, "| Laptops HUB");
assert.equal(custom.homeTitle, "Laptops HUB Bahawalpur");
assert.equal(custom.homeDescription, "Shop laptops");
assert.equal(cleanSeoText("a".repeat(500), 120).length, 120);
assert.equal(cleanSeoText(42, 10), "");
assert.ok(DEFAULT_HOME_TITLE.includes("Laptops HUB") && DEFAULT_HOME_TITLE.includes("Bahawalpur"));

// Guide markup: only fields that are set; publisher is the business node.
const art = articleJsonLd(ORIGIN, "/guides/x", "Title", "Desc", {
  seoTitle: "",
  seoDescription: "",
  image: "",
  author: "",
  publishedAt: "2026-11-01T00:00:00Z",
  modifiedAt: null,
});
assert.equal(art.datePublished, "2026-11-01T00:00:00Z");
assert.equal("dateModified" in art, false);
assert.deepEqual(art.author, { "@id": `${ORIGIN}/#organization` });
assert.equal(art.image, `${ORIGIN}/brand/laptops-hub-share-1200x630.png`);
const crumbs = breadcrumbJsonLd(ORIGIN, [{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }]);
assert.equal(crumbs.itemListElement[1].item, `${ORIGIN}/guides`);

// Shared search titles: case-insensitive groups of 2+, largest first; blanks ignored.
const shared = sharedSearchTitles(
  [
    { h: "a", t: "Dell 5320 · i5" },
    { h: "b", t: "dell 5320 · I5" },
    { h: "c", t: "HP 840" },
    { h: "d", t: "Lenovo L13" },
    { h: "e", t: "Lenovo L13" },
    { h: "f", t: "Lenovo L13" },
    { h: "g", t: "  " },
    { h: "h", t: "" },
  ],
  (x) => x.t,
);
assert.deepEqual(shared.map((g) => [g.title, g.items.map((i) => i.h)]), [
  ["Lenovo L13", ["d", "e", "f"]],
  ["Dell 5320 · i5", ["a", "b"]],
]);

console.log("seo-site.test.ts: ok");
