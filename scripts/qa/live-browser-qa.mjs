/**
 * READ-ONLY live QA of the production storefront in Chromium, WebKit and Firefox (desktop + phone).
 * No sign-in, no form submission, no cart/checkout actions: it only loads pages and inspects them.
 * Usage: node scripts/qa/live-browser-qa.mjs [https://www.laptopshub.pk]
 */
import { chromium, webkit, firefox, devices } from "@playwright/test";
import fs from "node:fs";

const base = process.argv[2] || "https://www.laptopshub.pk";
if (!/^https:\/\/(www\.)?laptopshub\.pk$/.test(base)) throw new Error("production storefront only");
const OUT = "docs/evidence/live-qa";
fs.mkdirSync(OUT, { recursive: true });

const sitemap = await (await fetch(base + "/sitemap.xml")).text();
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const pick = (re) => locs.find((p) => re.test(p));
const routes = [
  "/",
  "/collections/all",
  pick(/^\/collections\/(?!all$)/),
  pick(/^\/products\//),
  "/search?q=dell",
  pick(/^\/pages\//),
  "/cart",
  "/checkout",
  "/track-order",
  "/admin/login",
  "/this-page-does-not-exist",
].filter(Boolean);

const engines = { chromium, webkit, firefox };
const viewports = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { ...devices["iPhone 13"], defaultBrowserType: undefined },
};
const results = [];
const rec = (r) => {
  results.push(r);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.engine}/${r.vp} ${r.check}${r.detail ? " — " + r.detail : ""}`);
};

for (const [engineName, engine] of Object.entries(engines)) {
  const browser = await engine.launch();
  for (const [vp, opts] of Object.entries(viewports)) {
    const o = { ...opts };
    delete o.defaultBrowserType;
    if (engineName === "firefox") delete o.isMobile;
    const ctx = await browser.newContext(o);
    for (const path of routes) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !/Failed to load resource.*(404|favicon)|maps\.(googleapis|gstatic)|google\.com\/maps/i.test(m.text())) errors.push(m.text());
      });
      const t0 = Date.now();
      const resp = await page.goto(base + path, { waitUntil: "load", timeout: 60_000 }).catch((e) => ({ status: () => 0, err: e.message }));
      const ms = Date.now() - t0;
      const status = resp.status();
      const expect404 = path === "/this-page-does-not-exist";
      const statusOk = expect404 ? status === 404 : status === 200;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => -1);
      const appError = await page.locator("text=/Application error|Something went wrong/i").count().catch(() => 0);
      rec({
        engine: engineName, vp, check: `GET ${path}`, ok: statusOk && overflow <= 1 && appError === 0 && errors.length === 0,
        detail: `status ${status}, ${ms} ms, overflow ${overflow}px${errors.length ? ", errors: " + errors.slice(0, 2).join(" | ").slice(0, 200) : ""}`,
      });
      if (path === "/") {
        // Reviews section must be absent until genuine reviews are published; no aggregate rating claims.
        const reviews = await page.locator('[data-testid^="store-reviews"]').count();
        const fake = await page.locator("text=/157 reviews|4\\.9 out of 5/i").count();
        rec({ engine: engineName, vp, check: "home: no unpublished reviews, no rating claims", ok: reviews === 0 && fake === 0, detail: `reviews ${reviews}, claims ${fake}` });
        // Map: lazy (no iframe src before scrolling), loads near the bottom, link reachable.
        const iframe = page.getByTestId("store-map-iframe");
        const srcBefore = await iframe.getAttribute("src").catch(() => null);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(1500);
        const srcAfter = await iframe.getAttribute("src").catch(() => null);
        const open = page.getByTestId("store-map-open");
        const box = await open.boundingBox().catch(() => null);
        let reachable = false;
        if (box) {
          reachable = await page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            return !!el && !!el.closest('[data-testid="store-map-open"]');
          }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
        }
        rec({
          engine: engineName, vp, check: "home: map lazy, loads at bottom, Open in Google Maps reachable",
          ok: !srcBefore?.includes("google.com/maps/embed") && !!srcAfter?.includes("google.com/maps/embed") && reachable,
          detail: `before ${srcBefore ? "set" : "unset"}, after ${srcAfter ? "set" : "unset"}, link reachable ${reachable}`,
        });
        await page.screenshot({ path: `${OUT}/home-bottom-${engineName}-${vp}.png` });
      }
      if (path === "/checkout") {
        const cod = await page.locator("text=/Cash on delivery/i").locator("visible=true").count().catch(() => 0);
        const placeOrder = await page.getByRole("button", { name: /place order/i }).count();
        rec({ engine: engineName, vp, check: "checkout: public COD not offered", ok: placeOrder === 0, detail: `place-order buttons ${placeOrder}, COD mentions ${cod}` });
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), base, routes, passed: results.length - failed.length, total: results.length, results }, null, 2));
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
