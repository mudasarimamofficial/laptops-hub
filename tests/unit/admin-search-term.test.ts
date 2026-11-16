import assert from "node:assert/strict";
import { adminSearchTerm, phoneDigits } from "../../src/lib/admin/search-term";

// PostgREST filter syntax cannot be injected into or=(…) filters.
assert.equal(adminSearchTerm("a,status.eq.draft"), "a status.eq.draft");
assert.equal(adminSearchTerm("x)or(id.not.is.null"), "x or id.not.is.null");
assert.equal(adminSearchTerm("M. Ali"), "M. Ali");
assert.equal(adminSearchTerm('"quoted" \\ back'), "quoted back");
// LIKE wildcards are searched for as plain text, not as patterns.
assert.equal(adminSearchTerm("100%"), "100");
assert.equal(adminSearchTerm("a_b*c"), "a b c");
// Normal terms are kept.
assert.equal(adminSearchTerm("  Dell   Latitude 7420 "), "Dell Latitude 7420");
assert.equal(adminSearchTerm("LH-261116-ABC123"), "LH-261116-ABC123");
assert.equal(adminSearchTerm("ISO-dell-latitu"), "ISO-dell-latitu");
// Length cap and non-strings.
assert.equal(adminSearchTerm("x".repeat(200)).length, 60);
assert.equal(adminSearchTerm(null), "");
assert.equal(adminSearchTerm(42), "");

// Phone digits match customer_phone_normalized (10-digit national number).
assert.equal(phoneDigits("0300 1112233"), "3001112233");
assert.equal(phoneDigits("+92 300 1112233"), "3001112233");
assert.equal(phoneDigits("2233"), "2233");
assert.equal(phoneDigits("abc12"), null);
assert.equal(phoneDigits("LH-261116"), "261116");

console.log("admin-search-term tests passed");
