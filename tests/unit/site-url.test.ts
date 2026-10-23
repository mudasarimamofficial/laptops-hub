import assert from "node:assert/strict";
import { isPrelaunch, siteUrl } from "../../src/lib/site-url";
import robots from "../../src/app/robots";

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

// Pre-launch: off by default; when on, robots disallow everything and advertise no sitemap.
assert.equal(isPrelaunch(), false);
assert.ok(JSON.stringify(robots()).includes("/admin/"));
process.env.SITE_PRELAUNCH = "1";
assert.equal(isPrelaunch(), true);
assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } });
reset();
console.log("site-url.test.ts ok");
