/**
 * Matched-harness LCP matrix runner for /__diag/lcp-lab modes + controls.
 * Requires local or preview base with ENABLE_LCP_LAB / preview / development.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const OUT_DIR = "docs/visual-evidence/p0-perf-2026-11-23";
fs.mkdirSync(OUT_DIR, { recursive: true });
const RUNS = Number(process.env.LCP_MATRIX_RUNS || 3);

const modes = [
  { id: "A", url: `${BASE}/diag/lcp-lab?mode=A` },
  { id: "A-font", url: `${BASE}/diag/lcp-lab?mode=A-font` },
  { id: "B", url: `${BASE}/diag/lcp-lab?mode=B` },
  { id: "C", url: `${BASE}/diag/lcp-lab?mode=C` },
  { id: "D", url: `${BASE}/diag/lcp-lab?mode=D` },
  { id: "E-transform", url: `${BASE}/diag/lcp-lab?mode=E-transform` },
  { id: "E-blend", url: `${BASE}/diag/lcp-lab?mode=E-blend` },
  { id: "E-isolation", url: `${BASE}/diag/lcp-lab?mode=E-isolation` },
  { id: "E-intro", url: `${BASE}/diag/lcp-lab?mode=E-intro` },
  { id: "E-parallax", url: `${BASE}/diag/lcp-lab?mode=E-parallax` },
  { id: "E-calc-opacity", url: `${BASE}/diag/lcp-lab?mode=E-calc-opacity` },
  { id: "E-full-hero-shell", url: `${BASE}/diag/lcp-lab?mode=E-full-hero-shell` },
  { id: "F", url: `${BASE}/diag/lcp-lab?mode=F` },
  { id: "G-real-hero", url: `${BASE}/diag/lcp-lab-real-hero` },
  { id: "chrome-A", url: `${BASE}/diag/lcp-lab-chrome?mode=A` },
  { id: "control-coll", url: `${BASE}/collections/laptops` },
  { id: "G-home", url: `${BASE}/` },
];

async function once(id, url, run) {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__l = [];
      window.__p = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__l.push({ t: Math.round(e.startTime), s: e.size, tag: e.element?.tagName || null, u: (e.url || "").slice(-70) });
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__p.push({ n: e.name, t: Math.round(e.startTime) });
      }).observe({ type: "paint", buffered: true });
    });
    const t0 = Date.now();
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.bringToFront();
    await page.waitForTimeout(5000);
    const d = await page.evaluate(() => ({
      statusHint: document.title,
      vis: document.visibilityState,
      lcp: window.__l,
      paints: window.__p,
      h1: document.querySelector("h1")?.textContent?.trim().slice(0, 50) || null,
      notFound: /404|not found/i.test(document.body?.innerText || ""),
    }));
    const shot = path.join(OUT_DIR, `matrix-${id.replace(/[^\w-]+/g, "_")}-r${run}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    return {
      id,
      run,
      url,
      http: res?.status() ?? null,
      elapsedMs: Date.now() - t0,
      fcp: d.paints.find((p) => p.n === "first-contentful-paint")?.t ?? null,
      lcpCount: d.lcp.length,
      lcp: d.lcp.at(-1) || null,
      h1: d.h1,
      notFound: d.notFound,
      vis: d.vis,
      screenshot: shot,
    };
  } finally {
    await browser.close();
  }
}

const results = [];
for (const m of modes) {
  for (let run = 1; run <= RUNS; run++) {
    try {
      const r = await once(m.id, m.url, run);
      results.push(r);
      console.log(JSON.stringify({ id: r.id, run, fcp: r.fcp, lcpCount: r.lcpCount, lcp: r.lcp, http: r.http, notFound: r.notFound }));
    } catch (e) {
      results.push({ id: m.id, run, url: m.url, error: String(e) });
      console.error(m.id, run, e);
    }
  }
}

function median(nums) {
  const a = nums.filter((n) => n != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

const byId = {};
for (const r of results) {
  (byId[r.id] ||= []).push(r);
}
const summary = Object.fromEntries(
  Object.entries(byId).map(([id, rows]) => {
    const lcpCounts = rows.map((r) => r.lcpCount ?? 0);
    const fcps = rows.map((r) => r.fcp);
    const hasLcp = lcpCounts.some((c) => c > 0);
    return [
      id,
      {
        runs: rows.length,
        lcpReported: hasLcp,
        lcpCountMedian: median(lcpCounts),
        lcpCountSpread: `${Math.min(...lcpCounts)}-${Math.max(...lcpCounts)}`,
        fcpMedian: median(fcps),
        fcpSpread: `${Math.min(...fcps.filter(Boolean))}-${Math.max(...fcps.filter(Boolean))}`,
        sampleLcp: rows.find((r) => r.lcp)?.lcp || null,
        errors: rows.filter((r) => r.error).map((r) => r.error),
      },
    ];
  }),
);

const out = {
  at: new Date().toISOString(),
  base: BASE,
  device: "Pixel 7",
  channel: "chrome",
  runsPerMode: RUNS,
  summary,
  results,
};
fs.writeFileSync(path.join(OUT_DIR, "lcp-matrix.json"), JSON.stringify(out, null, 2));
console.log("\nSUMMARY\n", JSON.stringify(summary, null, 2));
