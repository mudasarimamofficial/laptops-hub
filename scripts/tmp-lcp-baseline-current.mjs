/**
 * Post-PR#60/#61 production baseline LCP diagnostic.
 * Supersedes historical lcp-diag.json (16:40 UTC, pre-#59/#60).
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "docs/visual-evidence/p0-perf-2026-11-23";
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "lcp-diag-post-pr60.json");

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://www.laptopshub.pk";
const routes = [
  { id: "home", url: `${BASE}/` },
  { id: "pdp", url: `${BASE}/products/dell-5400-core-i5-8th-gen-8gb-ram-256gb-storage` },
  { id: "coll", url: `${BASE}/collections/laptops` },
];

async function measure(label, url, { reducedMotion = null, run = 1 } = {}) {
  const browser = await chromium.launch({ headless: true, channel: "chrome", args: ["--disable-dev-shm-usage"] });
  try {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      reducedMotion: reducedMotion || undefined,
    });
    const page = await context.newPage();
    const ua = await page.evaluate(() => navigator.userAgent);
    await page.addInitScript(() => {
      window.__diag = { lcp: [], paints: [], cls: 0, longTasks: 0, longTaskMs: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__diag.lcp.push({
            t: Math.round(e.startTime),
            s: e.size,
            u: (e.url || "").slice(-90),
            tag: e.element?.tagName || null,
            cls: (e.element?.className || "").toString().slice(0, 80),
          });
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__diag.paints.push({ n: e.name, t: Math.round(e.startTime) });
      }).observe({ type: "paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__diag.cls += e.hadRecentInput ? 0 : e.value;
      }).observe({ type: "layout-shift", buffered: true });
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__diag.longTasks++;
            window.__diag.longTaskMs += e.duration;
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        /* longtask may be unavailable */
      }
    });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.bringToFront();
    await page.waitForTimeout(5000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(400);
    const data = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const h1cs = h1 ? getComputedStyle(h1) : null;
      const mainImg = document.querySelector(".v5-hero img[fetchpriority='high'], .v5-hero img[fetchPriority='high'], img[fetchpriority='high']");
      const stage = [...document.querySelectorAll('img[src*="stage"], img[srcset*="stage"]')].map((img) => ({
        currentSrc: (img.currentSrc || "").split("/").pop(),
        w: img.naturalWidth,
        cssW: Math.round(img.getBoundingClientRect().width),
      }));
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        vis: document.visibilityState,
        hidden: document.hidden,
        title: document.title,
        diag: window.__diag,
        bufferedLcp: performance.getEntriesByType("largest-contentful-paint").map((e) => ({
          t: Math.round(e.startTime),
          s: e.size,
          u: (e.url || "").slice(-70),
        })),
        nav: nav
          ? {
              ttfb: Math.round(nav.responseStart),
              dcl: Math.round(nav.domContentLoadedEventEnd),
              load: Math.round(nav.loadEventEnd),
            }
          : null,
        h1: h1
          ? {
              text: (h1.textContent || "").trim().slice(0, 60),
              op: h1cs.opacity,
              transform: h1cs.transform,
              vis: h1cs.visibility,
              display: h1cs.display,
            }
          : null,
        mainImg: mainImg
          ? {
              complete: mainImg.complete,
              op: getComputedStyle(mainImg).opacity,
              transform: getComputedStyle(mainImg).transform,
              filter: getComputedStyle(mainImg).filter,
              blend: getComputedStyle(mainImg.parentElement || mainImg).mixBlendMode,
              src: (mainImg.currentSrc || "").slice(-80),
            }
          : null,
        stage,
      };
    });
    const shot = path.join(OUT_DIR, `baseline-${label}-r${run}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    return {
      label,
      run,
      url,
      elapsedMs: Date.now() - t0,
      userAgent: ua,
      screenshot: shot,
      ...data,
    };
  } finally {
    await browser.close();
  }
}

const chromeVer = (await chromium.launch({ channel: "chrome", headless: true }).then(async (b) => {
  const p = await b.newPage();
  const v = await p.evaluate(() => navigator.userAgent);
  await b.close();
  return v;
}));

const results = [];
for (const r of routes) {
  for (let run = 1; run <= 3; run++) {
    results.push(await measure(r.id, r.url, { run }));
    const last = results.at(-1);
    console.log(
      JSON.stringify({
        id: r.id,
        run,
        fcp: last.diag?.paints?.find((p) => p.n === "first-contentful-paint")?.t,
        lcpCount: last.diag?.lcp?.length,
        lastLcp: last.diag?.lcp?.at(-1),
        cls: last.diag?.cls,
        ttfb: last.nav?.ttfb,
        stage: last.stage,
      }),
    );
  }
}
results.push(await measure("home-rm", `${BASE}/`, { reducedMotion: "reduce", run: 1 }));

const meta = {
  at: new Date().toISOString(),
  note: "CURRENT production baseline after PR #60/#61. Historical lcp-diag.json @ 16:40Z is pre-fix.",
  expectedCommit: "6fe4f3dd86c91149563e0c1d150e5555c9c20409",
  expectedDeployment: "dpl_jhGSuJihQU3S19Vj7q9hWaosXd44",
  device: "Pixel 7 (Playwright)",
  channel: "chrome",
  chromeUserAgent: chromeVer,
  harness: "cold context per run, wait 5s, visibilitychange finalize",
  results,
};
fs.writeFileSync(OUT, JSON.stringify(meta, null, 2));
console.log("wrote", OUT);
