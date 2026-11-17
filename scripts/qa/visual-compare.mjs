/**
 * Read-only visual regression of the homepage: base A (e.g. production, previous code) vs base B (e.g. the protected
 * Preview of the new code, reading the same production data). Desktop + phone, normal + reduced motion.
 * Per section band: full-page screenshots after the page settles, pixel diff (pixelmatch), plus CLS, horizontal
 * overflow, reviews/map presence and keyboard focus on the map link.
 *
 * Usage: node scripts/qa/visual-compare.mjs <baseA> <baseB> [outDir]
 * Env:   VERCEL_BYPASS (optional) — Vercel protection-bypass secret, sent only to baseB. Never printed.
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const [A, B, OUT = "docs/evidence/visual-regression"] = process.argv.slice(2);
if (!A || !B) throw new Error("usage: visual-compare.mjs <baseA> <baseB> [outDir]");
fs.mkdirSync(OUT, { recursive: true });
const bypass = process.env.VERCEL_BYPASS;

const CASES = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
  { name: "desktop-reduced", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" },
  { name: "phone", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference", isMobile: true, hasTouch: true },
  { name: "phone-reduced", viewport: { width: 390, height: 844 }, reducedMotion: "reduce", isMobile: true, hasTouch: true },
];

async function capture(browser, base, c, useBypass) {
  const ctx = await browser.newContext({
    viewport: c.viewport,
    reducedMotion: c.reducedMotion,
    isMobile: !!c.isMobile,
    hasTouch: !!c.hasTouch,
    extraHTTPHeaders: useBypass && bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : {},
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const res = await page.goto(base + "/", { waitUntil: "networkidle", timeout: 60_000 });
  // Scroll through so lazy images and the map mount, then back to the top.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += c.viewport.height) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  // Freeze motion for a deterministic picture (does not change layout).
  await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}" });
  const info = await page.evaluate(() => ({
    cls: window.__cls,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    height: document.documentElement.scrollHeight,
    reviews: !!document.querySelector('[data-testid="store-reviews"]'),
    map: !!document.querySelector('[data-testid="store-map"]'),
    mapPosition: getComputedStyle(document.querySelector('[data-testid="store-map"]') || document.body).position,
    mapAfterFooter: (() => {
      const f = document.querySelector("footer"), m = document.querySelector('[data-testid="store-map"]');
      return !!f && !!m && (f.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
    })(),
    sections: [...document.querySelectorAll("main > *")].map((e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "")).join(" "),
  }));
  const file = `${OUT}/${c.name}-${useBypass ? "B" : "A"}.png`;
  await page.screenshot({ path: file, fullPage: true });
  // Keyboard: focus the map link; it must be visible and not covered.
  let focusOk = null;
  if (info.map) {
    await page.getByTestId("store-map-open").focus();
    await page.waitForTimeout(600);
    focusOk = await page.getByTestId("store-map-open").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.top >= 0 && r.bottom <= innerHeight && !!hit && (hit === el || el.contains(hit));
    });
  }
  await ctx.close();
  return { status: res?.status(), file, ...info, focusOk };
}

function diff(fa, fb, out) {
  const a = PNG.sync.read(fs.readFileSync(fa));
  const b = PNG.sync.read(fs.readFileSync(fb));
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const crop = (img) => {
    const o = new PNG({ width: w, height: h });
    PNG.bitblt(img, o, 0, 0, w, h, 0, 0);
    return o;
  };
  const ca = crop(a), cb = crop(b), d = new PNG({ width: w, height: h });
  const n = pixelmatch(ca.data, cb.data, d.data, w, h, { threshold: 0.1 });
  fs.writeFileSync(out, PNG.sync.write(d));
  return { sameSize: a.width === b.width && a.height === b.height, sizeA: [a.width, a.height], sizeB: [b.width, b.height], diffPixels: n, diffRatio: +(n / (w * h)).toFixed(6) };
}

const browser = await chromium.launch();
const results = [];
for (const c of CASES) {
  const ra = await capture(browser, A, c, false);
  const rb = await capture(browser, B, c, true);
  const d = diff(ra.file, rb.file, `${OUT}/${c.name}-diff.png`);
  results.push({ case: c.name, A: ra, B: rb, diff: d });
  console.log(
    `${c.name}: diff ${d.diffPixels}px (${d.diffRatio}) size ${d.sizeA}→${d.sizeB} | CLS ${ra.cls.toFixed(4)}→${rb.cls.toFixed(4)} | overflow ${ra.overflow}/${rb.overflow} | reviews ${ra.reviews}/${rb.reviews} | map ${ra.mapPosition}/${rb.mapPosition} afterFooter ${ra.mapAfterFooter}/${rb.mapAfterFooter} | focus ${ra.focusOk}/${rb.focusOk} | sections same ${ra.sections === rb.sections}`,
  );
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ A, B: B.replace(/\/\/[^/]+/, "//<preview>"), at: new Date().toISOString(), results }, null, 2));
