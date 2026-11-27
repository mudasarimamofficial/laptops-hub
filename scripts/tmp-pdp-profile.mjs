/**
 * PDP main-thread / coverage profile under matched Pixel 7 harness (no LH throttle).
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://www.laptopshub.pk";
const URL = `${BASE}/products/dell-5400-core-i5-8th-gen-8gb-ram-256gb-storage`;
const OUT_DIR = "docs/visual-evidence/p0-perf-2026-11-23";
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();

await context.tracing.start({ screenshots: true, snapshots: true });

const scripts = [];
page.on("response", async (res) => {
  try {
    const ct = res.headers()["content-type"] || "";
    const u = res.url();
    if (!/javascript|ecmascript|script/i.test(ct) && !/\.js(\?|$)/i.test(u)) return;
    const buf = await res.body().catch(() => null);
    scripts.push({ url: u.slice(0, 160), bytes: buf?.length ?? null, status: res.status() });
  } catch {
    /* ignore */
  }
});

await page.coverage.startJSCoverage({ resetOnNavigation: true });
const t0 = Date.now();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const paints = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]));
  const lcp = performance.getEntriesByType("largest-contentful-paint");
  const resources = performance.getEntriesByType("resource").map((r) => ({
    name: r.name.slice(0, 120),
    type: r.initiatorType,
    dur: Math.round(r.duration),
    transfer: r.transferSize,
    encoded: r.encodedBodySize,
  }));
  const longtasks = performance.getEntriesByType("longtask")?.map((t) => ({ start: Math.round(t.startTime), dur: Math.round(t.duration) })) || [];
  return {
    paints,
    lcp: lcp.map((e) => ({ t: Math.round(e.startTime), s: e.size, u: (e.url || "").slice(-80) })),
    ttfb: nav ? Math.round(nav.responseStart) : null,
    dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    load: nav ? Math.round(nav.loadEventEnd) : null,
    longtasks,
    topResources: resources.sort((a, b) => b.dur - a.dur).slice(0, 25),
    heaviestTransfer: resources.sort((a, b) => (b.transfer || 0) - (a.transfer || 0)).slice(0, 20),
  };
});
const coverage = await page.coverage.stopJSCoverage();
await context.tracing.stop({ path: path.join(OUT_DIR, "pdp-trace.zip") });

const covSummary = coverage
  .map((e) => {
    const total = e.functions.reduce((n, f) => n + (f.endOffset - f.startOffset), 0);
    const used = e.functions.reduce((n, f) => n + f.ranges.reduce((m, r) => m + (r.count ? r.endOffset - r.startOffset : 0), 0), 0);
    return { url: e.url.slice(0, 140), total, used, unused: Math.max(0, total - used) };
  })
  .filter((e) => e.total > 5000)
  .sort((a, b) => b.unused - a.unused)
  .slice(0, 30);

const out = {
  at: new Date().toISOString(),
  url: URL,
  elapsedMs: Date.now() - t0,
  device: "Pixel 7",
  channel: "chrome",
  note: "Unthrottled Playwright profile — not Lighthouse DevTools throttle.",
  metrics,
  scriptResponses: scripts.sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 40),
  jsCoverageTopUnused: covSummary,
};
fs.writeFileSync(path.join(OUT_DIR, "pdp-profile.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ lcp: metrics.lcp, fcp: metrics.paints, longtasks: metrics.longtasks, topUnused: covSummary.slice(0, 8), topScripts: scripts.slice(0, 8) }, null, 2));
await browser.close();
