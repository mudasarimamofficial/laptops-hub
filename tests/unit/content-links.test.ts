import assert from "node:assert/strict";
import { isLinkPublic, mandatoryPoliciesPublic, publicLinks, supportHref, unlinkUnpublished, type Visibility } from "../../src/lib/content/links";

const none: Visibility = { pages: {}, articles: {} };
const some: Visibility = { pages: { faq: false, contact: true, shipping: true }, articles: { "core-i5-vs-i7": true } };

// Unpublished content is never linked; other links are untouched.
assert.equal(isLinkPublic("/pages/faq", none), false);
assert.equal(isLinkPublic("/pages/contact", some), true);
assert.equal(isLinkPublic("/pages/contact#form", some), true);
assert.equal(isLinkPublic("/guides", none), false);
assert.equal(isLinkPublic("/guides", some), true);
assert.equal(isLinkPublic("/guides/core-i5-vs-i7", some), true);
assert.equal(isLinkPublic("/guides/other", some), false);
assert.equal(isLinkPublic("/collections/all", none), true);
assert.equal(isLinkPublic("/track-order", none), true);
assert.deepEqual(
  publicLinks([{ href: "/pages/faq" }, { href: "/pages/contact" }, { href: "/compare" }], some).map((l) => l.href),
  ["/pages/contact", "/compare"],
);

// Support link: first public help page, else order tracking (always available).
assert.equal(supportHref(some), "/pages/contact");
assert.equal(supportHref({ pages: { faq: true }, articles: {} }), "/pages/faq");
assert.equal(supportHref(none), "/track-order");

// Checkout gate: all five policies public.
assert.equal(mandatoryPoliciesPublic(some), false);
assert.equal(mandatoryPoliciesPublic({ pages: { shipping: true, returns: true, warranty: true, privacy: true, terms: true }, articles: {} }), true);

console.log("content-links.test.ts ok");

// Published copy never links to content that is not public; other links stay.
{
  const html = '<p>Read <a href="/pages/how-to-choose">how to choose</a>, <a href="/pages/contact">contact us</a>, <a href="/compare">compare</a> or <a href="https://example.com/x">elsewhere</a>.</p>';
  const out = unlinkUnpublished(html, some);
  assert.equal(out, '<p>Read how to choose, <a href="/pages/contact">contact us</a>, <a href="/compare">compare</a> or <a href="https://example.com/x">elsewhere</a>.</p>');
  console.log("unlinkUnpublished ok");
}
