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

console.log("navigation.test.ts ok");
