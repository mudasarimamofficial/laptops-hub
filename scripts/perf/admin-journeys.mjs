/**
 * Admin latency: signs in as the isolated owner and times 18 admin journeys (full navigations), reporting server
 * response time (TTFB) and time to `load`, p50/p75/p95 over N runs after one warm-up. LOCAL isolated stack only.
 *
 * Usage: node scripts/perf/admin-journeys.mjs <baseUrl> <label> [runs=7]
 * Output: docs/evidence/admin-perf/<label>.json
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base = "http://127.0.0.1:3001", label = "local", runsArg = "7"] = process.argv.slice(2);
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error("local base URL only");
const RUNS = Number(runsArg);
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const P = fx.products[0].handle;
const JOURNEYS = [
  ["overview", "/admin"],
  ["products", "/admin/products"],
  ["product-search", "/admin/products?q=dell"],
  ["product-edit", `/admin/products/${P}`],
  ["product-new", "/admin/products/new"],
  ["products-bulk", "/admin/products/bulk"],
  ["orders", "/admin/orders"],
  ["customers", "/admin/customers"],
  ["inventory", "/admin/inventory"],
  ["collections", "/admin/collections"],
  ["collection-edit", "/admin/collections/laptops"],
  ["reviews", "/admin/reviews"],
  ["testimonials", "/admin/reviews/testimonials"],
  ["online-store", "/admin/online-store"],
  ["settings", "/admin/settings"],
  ["staff", "/admin/staff"],
  ["analytics", "/admin/analytics"],
  ["navigation", "/admin/navigation"],
];

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]);
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/admin/login`);
await page.getByLabel("Email").fill(fx.staff.owner.email);
await page.getByLabel("Password").fill(fx.staff.owner.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/admin(\?|$|\/(?!login))/, { timeout: 60_000 });

const results = [];
for (const [name, path] of JOURNEYS) {
  const ttfb = [];
  const load = [];
  for (let i = 0; i <= RUNS; i++) {
    const res = await page.goto(base + path, { waitUntil: "load", timeout: 60_000 });
    if (!res || res.status() >= 400) throw new Error(`${name}: HTTP ${res?.status()}`);
    if (page.url().includes("/admin/login")) throw new Error(`${name}: signed out`);
    const t = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return { ttfb: n.responseStart - n.requestStart, load: n.loadEventStart - n.startTime };
    });
    if (i === 0) continue; // warm-up
    ttfb.push(t.ttfb);
    load.push(t.load);
  }
  const row = {
    journey: name,
    path,
    ttfb: { p50: pct(ttfb, 50), p75: pct(ttfb, 75), p95: pct(ttfb, 95) },
    load: { p50: pct(load, 50), p75: pct(load, 75), p95: pct(load, 95) },
  };
  results.push(row);
  console.log(name.padEnd(16), "ttfb", JSON.stringify(row.ttfb), "load", JSON.stringify(row.load));
}
await browser.close();
const all = (k, p) => pct(results.map((r) => r[k][p]), 50);
fs.mkdirSync("docs/evidence/admin-perf", { recursive: true });
fs.writeFileSync(
  `docs/evidence/admin-perf/${label}.json`,
  JSON.stringify({ at: new Date().toISOString(), base, label, runs: RUNS, results, medianOfJourneyP50: { ttfb: all("ttfb", "p50"), load: all("load", "p50") } }, null, 2),
);
console.log("median of journey p50 ttfb", all("ttfb", "p50"), "load", all("load", "p50"));
