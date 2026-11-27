/**
 * Binary-search which homepage section set first loses LCP.
 * Requires local server with /diag/lcp-lab-home.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const OUT_DIR = "docs/visual-evidence/p0-perf-2026-11-23";
fs.mkdirSync(OUT_DIR, { recursive: true });
const RUNS = Number(process.env.LCP_MATRIX_RUNS || 3);

const sets = [
  { id: "hero-only", only: "v5_cinematic_hero" },
  { id: "hero+story", only: "v5_cinematic_hero,v5_product_story" },
  { id: "hero+chromebook", only: "v5_cinematic_hero,v5_chromebook" },
  { id: "hero+brands", only: "v5_cinematic_hero,v5_brand_grid" },
  { id: "hero+featured", only: "v5_cinematic_hero,v5_featured_products" },
  { id: "hero+promo", only: "v5_cinematic_hero,v5_promo" },
  { id: "hero+specs", only: "v5_cinematic_hero,v5_spec_filters" },
  { id: "hero+newgen", only: "v5_cinematic_hero,v5_new_gen" },
  { id: "hero+budget", only: "v5_cinematic_hero,v5_budget_bands" },
  { id: "hero+compare", only: "v5_cinematic_hero,v5_compare_demo" },
  { id: "hero+reviews", only: "v5_cinematic_hero,v5_store_reviews" },
  { id: "hero+inquiry", only: "v5_cinematic_hero,v5_home_inquiry" },
  {
    id: "hero+all-except-story-reels",
    only: "v5_cinematic_hero,v5_chromebook,v5_brand_grid,v5_featured_products,v5_promo,v5_spec_filters,v5_new_gen,v5_budget_bands,v5_compare_demo,v5_store_reviews,v5_home_inquiry",
  },
  {
    id: "hero+story+featured",
    only: "v5_cinematic_hero,v5_product_story,v5_featured_products",
  },
  { id: "all-published", only: "" },
  { id: "prod-home", url: `${BASE}/` },
  { id: "real-hero-no-chrome", url: `${BASE}/diag/lcp-lab-real-hero` },
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
          window.__l.push({ t: Math.round(e.startTime), s: e.size, tag: e.element?.tagName || null, u: (e.url || "").slice(-80) });
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__p.push({ n: e.name, t: Math.round(e.startTime) });
      }).observe({ type: "paint", buffered: true });
    });
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.bringToFront();
    await page.waitForTimeout(5500);
    const d = await page.evaluate(() => ({
      lcp: window.__l,
      paints: window.__p,
      h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) || null,
      hero: !!document.querySelector(".v5-hero"),
      banner: document.querySelector("p")?.textContent?.slice(0, 80) || null,
    }));
    const shot = path.join(OUT_DIR, `bisect-${id.replace(/[^\w+-]+/g, "_")}-r${run}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    return {
      id,
      run,
      url,
      http: res?.status() ?? null,
      fcp: d.paints.find((p) => p.n === "first-contentful-paint")?.t ?? null,
      lcpCount: d.lcp.length,
      lcp: d.lcp.at(-1) || null,
      h1: d.h1,
      hero: d.hero,
      screenshot: shot,
    };
  } finally {
    await browser.close();
  }
}

const results = [];
for (const s of sets) {
  const url = s.url || `${BASE}/diag/lcp-lab-home${s.only ? `?only=${encodeURIComponent(s.only)}` : ""}`;
  for (let run = 1; run <= RUNS; run++) {
    const r = await once(s.id, url, run);
    results.push(r);
    console.log(JSON.stringify({ id: r.id, run, http: r.http, fcp: r.fcp, lcpCount: r.lcpCount, lcp: r.lcp, hero: r.hero }));
  }
}

const summary = {};
for (const r of results) {
  (summary[r.id] ||= { lcpCounts: [], fcps: [], sample: null });
  summary[r.id].lcpCounts.push(r.lcpCount);
  summary[r.id].fcps.push(r.fcp);
  if (r.lcp && !summary[r.id].sample) summary[r.id].sample = r.lcp;
}
for (const [id, s] of Object.entries(summary)) {
  const ok = s.lcpCounts.filter((c) => c > 0).length;
  summary[id] = {
    lcpPassRate: `${ok}/${s.lcpCounts.length}`,
    lcpReported: ok > 0,
    lcpCountSpread: `${Math.min(...s.lcpCounts)}-${Math.max(...s.lcpCounts)}`,
    fcpMedian: s.fcps.sort((a, b) => a - b)[Math.floor(s.fcps.length / 2)],
    sample: s.sample,
  };
}

const out = { at: new Date().toISOString(), base: BASE, runsPerSet: RUNS, summary, results };
fs.writeFileSync(path.join(OUT_DIR, "lcp-section-bisect.json"), JSON.stringify(out, null, 2));
console.log("\nSUMMARY\n", JSON.stringify(summary, null, 2));
