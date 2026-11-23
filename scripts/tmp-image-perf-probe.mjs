/**
 * Read-only production image/perf probe (Playwright). Records LCP-ish paint timing,
 * image transfer sizes, currentSrc vs CSS box. Not field CWV.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://www.laptopshub.pk";
const outDir = path.join("docs", "visual-evidence", "perf-2026-11-23");
fs.mkdirSync(outDir, { recursive: true });

const routes = ["/", "/collections/laptops", "/search?q=dell", "/products/dell-5400-core-i5-8th-gen-8gb-ram-256gb-storage"];

async function probe(page, route) {
  const responses = [];
  page.on("response", async (res) => {
    try {
      const ct = res.headers()["content-type"] || "";
      if (!/image\//i.test(ct) && !/\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(res.url())) return;
      const buf = await res.body().catch(() => null);
      responses.push({
        url: res.url().slice(0, 180),
        status: res.status(),
        bytes: buf?.length ?? null,
        contentType: ct.split(";")[0],
      });
    } catch {
      /* ignore */
    }
  });

  const started = Date.now();
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const metrics = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")].slice(0, 24).map((img) => {
      const r = img.getBoundingClientRect();
      return {
        alt: (img.alt || "").slice(0, 60),
        cssW: Math.round(r.width),
        cssH: Math.round(r.height),
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        currentSrc: (img.currentSrc || img.src || "").slice(0, 180),
        loading: img.loading || "",
        complete: img.complete,
      };
    });
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]));
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    const lcp = lcpEntries.length ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : null;
    return {
      dpr: window.devicePixelRatio,
      paint: paints,
      lcpMs: lcp,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      imgs,
      promoText: document.body.innerText.includes("FLAT 5% OFF"),
      featuredHeading: [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()).find((t) => t && /Latitude|EliteBook|ThinkPad|Dell|HP|Lenovo/i.test(t)) || null,
    };
  });
  const shot = path.join(outDir, `${route.replace(/[^\w]+/g, "_") || "home"}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  const imageBytes = responses.reduce((n, r) => n + (r.bytes || 0), 0);
  return {
    route,
    elapsedMs: Date.now() - started,
    metrics,
    imageResponses: responses.length,
    imageBytes,
    oversized: metrics.imgs.filter((i) => i.cssW > 0 && i.naturalW > i.cssW * metrics.dpr * 1.75 + 40),
    screenshot: shot,
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["Pixel 7"], deviceScaleFactor: 2 });
const page = await context.newPage();
const results = [];
for (const route of routes) {
  try {
    results.push(await probe(page, route));
  } catch (e) {
    results.push({ route, error: String(e) });
  }
}
await browser.close();

const summary = {
  date: new Date().toISOString(),
  base: BASE,
  device: "Pixel 7 emulated DPR2",
  note: "Lab diagnostic only — not CrUX field CWV. LCP from PerformanceObserver buffer may be incomplete without wait.",
  results,
};
fs.writeFileSync(path.join(outDir, "image-perf-probe.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ routes: results.length, outDir, totals: results.map((r) => ({ route: r.route, imageBytes: r.imageBytes, lcpMs: r.metrics?.lcpMs, oversized: r.oversized?.length, featuredHeading: r.metrics?.featuredHeading, promo: r.metrics?.promoText, err: r.error })) }, null, 2));
