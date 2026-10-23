import assert from "node:assert/strict";
import { canonicalFor, isPrelaunch, robotsFor, siteMode, siteUrl } from "../../src/lib/site-url";
import robots, { PRIVATE_PATHS } from "../../src/app/robots";

const KEYS = ["SITE_URL", "NEXT_PUBLIC_SITE_URL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "SITE_PRELAUNCH"];
const reset = () => KEYS.forEach((k) => delete process.env[k]);

reset();
assert.equal(siteUrl(), "http://localhost:3000");
// Production: the public production domain, never the SSO-protected deployment URL.
process.env.VERCEL_ENV = "production";
process.env.VERCEL_URL = "laptops-abc123-team.vercel.app";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "laptops-hub.vercel.app";
assert.equal(siteUrl(), "https://laptops-hub.vercel.app");
// Preview keeps its own deployment URL.
process.env.VERCEL_ENV = "preview";
assert.equal(siteUrl(), "https://laptops-abc123-team.vercel.app");
// Explicit SITE_URL wins (custom domain), trailing slash trimmed.
process.env.SITE_URL = "https://www.example.pk/";
assert.equal(siteUrl(), "https://www.example.pk");
reset();

// Modes: unset = launch; "1"/"seo" = SEO-only pre-launch; "restricted" = restricted pre-launch.
assert.equal(siteMode(undefined), "launch");
assert.equal(siteMode(""), "launch");
assert.equal(siteMode("0"), "launch");
assert.equal(siteMode("1"), "prelaunch");
assert.equal(siteMode(" SEO "), "prelaunch");
assert.equal(siteMode("restricted"), "restricted");
assert.equal(siteMode("Restricted"), "restricted");

// Launch: private routes disallowed, sitemap advertised, canonical paths emitted.
assert.equal(isPrelaunch(), false);
{
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  assert.equal(rules.allow, "/");
  assert.deepEqual(rules.disallow, PRIVATE_PATHS);
  assert.equal(r.sitemap, "http://localhost:3000/sitemap.xml");
  assert.deepEqual(canonicalFor("/products/x"), { canonical: "/products/x" });
  assert.equal(robotsFor(false), undefined);
  assert.deepEqual(robotsFor(true), { index: false, follow: true });
}
// Pre-launch (both modes): public pages stay crawlable (so noindex is seen), private routes still disallowed,
// no sitemap, no canonical links.
for (const v of ["1", "restricted"]) {
  process.env.SITE_PRELAUNCH = v;
  assert.equal(isPrelaunch(), true);
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  assert.equal(rules.allow, "/", "public pages must stay crawlable");
  assert.notEqual(rules.disallow, "/", "never Disallow: / (it would hide the noindex)");
  assert.deepEqual(rules.disallow, PRIVATE_PATHS);
  assert.equal(r.sitemap, undefined);
  assert.equal(canonicalFor("/products/x"), undefined);
  // Never an explicit undefined while pre-launch (it would drop the layout noindex).
  assert.deepEqual(robotsFor(false), { index: false, follow: true });
}
reset();
console.log("site-url.test.ts ok");
