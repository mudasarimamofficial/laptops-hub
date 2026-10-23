import assert from "node:assert/strict";
import { prelaunchDecision } from "../../src/lib/prelaunch";

const d = (url: string) => {
  const u = new URL(url, "https://laptops-hub.vercel.app");
  return prelaunchDecision(u.pathname, u.searchParams);
};

// Storefront pages → coming soon (including ones search engines already know).
for (const p of ["/", "/products/dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage", "/collections/laptops", "/collections/all?brand=Dell", "/search?q=thinkpad", "/compare", "/cart", "/checkout", "/pages/contact", "/guides", "/guides/how-much-ram", "/track-order", "/order/success/abc", "/does-not-exist"]) {
  assert.equal(d(p), "comingSoon", p);
}
// Staff work continues; framework assets, robots and sitemap stay reachable.
for (const p of ["/admin", "/admin/login", "/admin/orders/LH-1", "/api/admin/cod-collections", "/api/cron/notifications", "/coming-soon", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/_next/static/chunks/app.js", "/v5/stage.webp"]) {
  assert.equal(d(p), "allow", p);
}
// Look-alike prefixes are not admin.
assert.equal(d("/administrator"), "comingSoon");
assert.equal(d("/api/administrator"), "blockApi");
// Public APIs would expose the catalog the page hides.
for (const p of ["/api/catalog/search?q=dell", "/api/catalog/product?handle=x", "/api/catalog/compare", "/api/checkout/cod", "/api/checkout/quote", "/api/contact", "/api"]) {
  assert.equal(d(p), "blockApi", p);
}
// Image optimiser: local images only, never remote catalog photos (also protocol-relative tricks).
assert.equal(d("/_next/image?url=%2Fv5%2Fstage.webp&w=640&q=75"), "allow");
assert.equal(d("/_next/image?url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2Fx.jpg&w=640&q=75"), "blockImage");
assert.equal(d("/_next/image?url=%2F%2Fcdn.shopify.com%2Fx.jpg&w=640&q=75"), "blockImage");
assert.equal(d("/_next/image"), "blockImage");
console.log("prelaunch.test.ts ok");
