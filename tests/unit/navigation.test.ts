import assert from "node:assert/strict";
import {
  DEFAULT_FOOTER_COLUMNS,
  DEFAULT_HEADER_NAV,
  isSafeDestinationUrl,
  sanitizePublicFooterColumns,
  sanitizePublicNavLinks,
  type FooterNavColumn,
  type NavigationItem,
} from "@/lib/content/navigation";
import type { Visibility } from "@/lib/content/links";
import { NAV_LIMITS, V5_HEADER_WIDTH, estimateHeaderWidth, destinationHint, destinationProblem, navigationProblems } from "@/lib/content/navigation-rules";

console.log("Running navigation.test.ts...");

// 1. Defaults verification
assert.equal(DEFAULT_HEADER_NAV.length >= 5, true, "Header nav must have standard defaults");
assert.equal(DEFAULT_FOOTER_COLUMNS.length, 5, "Footer must have 5 columns");
assert.equal(DEFAULT_HEADER_NAV[0].label, "Dell");
assert.equal(DEFAULT_HEADER_NAV[0].href, "/collections/dell");

// 2. URL Safety validation
assert.equal(isSafeDestinationUrl("/collections/laptops"), true);
assert.equal(isSafeDestinationUrl("/pages/about"), true);
assert.equal(isSafeDestinationUrl("/guides/buying-guide"), true);
assert.equal(isSafeDestinationUrl("https://example.com/external"), true);
assert.equal(isSafeDestinationUrl("http://example.com/external"), true);

// Unsafe URLs MUST be rejected
assert.equal(isSafeDestinationUrl("/admin"), false, "Admin root must be rejected");
assert.equal(isSafeDestinationUrl("/admin/settings"), false, "Admin subpaths must be rejected");
assert.equal(isSafeDestinationUrl("/api/checkout"), false, "Internal API paths must be rejected");
assert.equal(isSafeDestinationUrl("javascript:alert(1)"), false, "javascript: must be rejected");
assert.equal(isSafeDestinationUrl("data:text/html,<h1>XSS</h1>"), false, "data: must be rejected");
assert.equal(isSafeDestinationUrl("vbscript:test"), false, "vbscript: must be rejected");
assert.equal(isSafeDestinationUrl(""), false, "Empty string must be rejected");

// 3. Link Public Filtering (Policy Gating)
const mockVis: Visibility = {
  pages: {
    about: true,
    faq: true,
    shipping: false, // Unpublished
    terms: false,    // Unpublished
  },
  articles: {
    "guide-1": true,
  },
};

const testLinks: NavigationItem[] = [
  { id: "1", label: "About", href: "/pages/about" },
  { id: "2", label: "Shipping Policy", href: "/pages/shipping" },
  { id: "3", label: "Dell", href: "/collections/dell" },
  { id: "4", label: "Admin Link", href: "/admin/products" },
];

const sanitized = sanitizePublicNavLinks(testLinks, mockVis);
assert.equal(sanitized.length, 2, "Unpublished shipping and unsafe admin link must be excluded");
assert.equal(sanitized.some((l) => l.label === "About"), true);
assert.equal(sanitized.some((l) => l.label === "Dell"), true);
assert.equal(sanitized.some((l) => l.label === "Shipping Policy"), false);
assert.equal(sanitized.some((l) => l.label === "Admin Link"), false);

// 4. Footer Column Sanitization
const testCols: FooterNavColumn[] = [
  {
    id: "col-1",
    title: "Company",
    links: [
      { id: "c1", label: "About", href: "/pages/about" },
      { id: "c2", label: "Dell", href: "/collections/dell" },
    ],
  },
  {
    id: "col-2",
    title: "Unpublished Column",
    links: [
      { id: "c3", label: "Shipping", href: "/pages/shipping" },
      { id: "c4", label: "Terms", href: "/pages/terms" },
    ],
  },
];

const sanitizedCols = sanitizePublicFooterColumns(testCols, mockVis);
assert.equal(sanitizedCols.length, 1, "Column with only unpublished links must be omitted");
assert.equal(sanitizedCols[0].title, "Company");
assert.equal(sanitizedCols[0].links.length, 2);

// 5. Disguised external and malformed addresses (G49)
for (const bad of ["//evil.example/x", "/\\evil.example", "/collections/dell x", "https://user:pw@example.com", "ftp://example.com", "collections/dell", "/API/x", "/Admin"]) {
  assert.equal(isSafeDestinationUrl(bad), false, bad);
  assert.equal(typeof destinationProblem(bad), "string", bad);
}
assert.equal(destinationProblem("/collections/dell?sort=price#top"), null);
assert.equal(destinationProblem("https://wa.me/923000000000"), null);

// 6. Whole-menu validation: names, addresses, unique ids, limits; an empty menu is allowed
assert.deepEqual(navigationProblems([], []), []);
assert.deepEqual(navigationProblems(DEFAULT_HEADER_NAV, DEFAULT_FOOTER_COLUMNS), [], "V5 defaults are valid");
const dup = navigationProblems([{ id: "a", label: "A", href: "/a" }, { id: "a", label: "B", href: "/b" }], []);
assert.equal(dup.length, 1);
assert.match(dup[0].message, /same id/);
assert.equal(navigationProblems([{ id: "a", label: " ", href: "/a" }], []).length, 1);
assert.equal(navigationProblems([{ id: "a", label: "x".repeat(NAV_LIMITS.label + 1), href: "/a" }], []).length, 1);
assert.equal(navigationProblems([{ id: "a", label: "A", href: "javascript:alert(1)" }], []).length, 1);
const many = Array.from({ length: NAV_LIMITS.headerItems + 1 }, (_, i) => ({ id: "h" + i, label: "L" + i, href: "/collections/x" + i }));
assert.equal(navigationProblems(many, []).some((p) => /at most/.test(p.message)), true);
assert.equal(navigationProblems([], [{ id: "c", title: "", links: [] }]).length, 1, "column heading required");

// 7. Hints for collections/pages that do not exist or are not published (non-blocking)
const cols = [{ slug: "dell" }];
const pgs = [{ slug: "faq", is_published: true }, { slug: "warranty", is_published: false }];
assert.equal(destinationHint("/collections/dell", cols, pgs), null);
assert.equal(destinationHint("/collections/all", cols, pgs), null);
assert.match(destinationHint("/collections/nope", cols, pgs) ?? "", /No collection/);
assert.equal(destinationHint("/pages/faq", cols, pgs), null);
assert.match(destinationHint("/pages/warranty", cols, pgs) ?? "", /not published/);
assert.match(destinationHint("/pages/missing", cols, pgs) ?? "", /No page/);

// 8. Header width warning: the V5 menu fits; the QA menu that overflowed 1280px in the browser is flagged.
assert.equal(estimateHeaderWidth(DEFAULT_HEADER_NAV) <= V5_HEADER_WIDTH, true);
const qa = [...DEFAULT_HEADER_NAV.slice(1, 5), { label: "QA Dell renamed" }, { label: "QA Workstations", isNew: true }, { label: "Support" }];
assert.equal(estimateHeaderWidth(qa) > V5_HEADER_WIDTH, true);
assert.equal(estimateHeaderWidth(DEFAULT_HEADER_NAV.filter((i) => i.id !== "h-guides")) < V5_HEADER_WIDTH, true);

console.log("navigation.test.ts ok");
