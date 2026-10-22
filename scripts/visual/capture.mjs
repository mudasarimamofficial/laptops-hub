/**
 * V5 parity capture: screenshots the frozen Claude Design reference and the Next.js app
 * under identical browser conditions, then writes pixel diffs.
 *
 *   node scripts/visual/capture.mjs [--only=home] [--vp=1440x900] [--next=http://127.0.0.1:3000]
 *
 * Reference: `Laptops Hub storefront/` served at REF (default http://127.0.0.1:4173).
 * Output: docs/visual-evidence/parity/<scene>/<vp>-{ref,next,diff}.png + results.json
 */
import fs from "fs";
import path from "path";
import os from "os";
import vm from "vm";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const REF = arg("ref", "http://127.0.0.1:4173");
const NEXT = arg("next", "http://127.0.0.1:3000");
const OUT = path.resolve(arg("out", "docs/visual-evidence/parity"));
const REF_PAGE = `${REF}/Laptops%20Hub%20Storefront%20v5.dc.html`;

export const VIEWPORTS = [
  [1920, 1080], [1897, 860], [1440, 900], [1366, 680], [1280, 800], [1024, 768],
  [905, 800], [768, 1024], [430, 932], [390, 844], [360, 780],
];

const STORY = "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage";
const HP = "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage";
// Identical cart/compare state for both apps, each in its own storage format.
const catCtx = { window: {} };
vm.runInNewContext(fs.readFileSync("Laptops Hub storefront/data/lh-catalog.js", "utf8"), catCtx);
const C7420 = catCtx.window.LH_CATALOG.find((p) => p.h === STORY);
const CART = {
  ref: { lh_cart: JSON.stringify([{ h: STORY, qty: 2 }]) },
  next: { "lh-cart-v1": JSON.stringify({ lines: [{ variantId: "fb445cbe-c294-4bd4-95e2-f1cd7daf57b8", handle: STORY, title: C7420.t, unitPricePaisa: C7420.price * 100, quantity: 2, imageUrl: C7420.imgs[0].u, maxPerOrder: 5, model: C7420.model, config: C7420.config, sku: C7420.sku }] }) },
};
const COMPARE = { ref: { lh_compare: JSON.stringify([STORY, HP]) }, next: { "lh-compare-v1": JSON.stringify({ handles: [STORY, HP] }) } };
/** Scenes: same state in both apps. `scroll` is a selector scrolled to the top of the viewport. */
export const SCENES = [
  { id: "home-top", ref: "#/", next: "/" },
  { id: "home-story", ref: "#/", next: "/", scroll: "#story" },
  { id: "home-full", ref: "#/", next: "/", full: true },
  { id: "collection-laptops", ref: "#/collections/laptops", next: "/collections/laptops" },
  { id: "collection-laptops-full", ref: "#/collections/laptops", next: "/collections/laptops", full: true },
  { id: "collection-chromebooks", ref: "#/collections/chromebooks", next: "/collections/chromebooks" },
  { id: "search-thinkpad", ref: "#/search/thinkpad", next: "/search?q=thinkpad" },
  { id: "pdp-7420", ref: `#/products/${STORY}`, next: `/products/${STORY}` },
  { id: "pdp-7420-full", ref: `#/products/${STORY}`, next: `/products/${STORY}`, full: true },
  { id: "cart-empty", ref: "#/cart", next: "/cart" },
  { id: "cart-line", ref: "#/cart", next: "/cart", storage: CART },
  { id: "compare-empty", ref: "#/compare", next: "/compare" },
  { id: "compare-two", ref: "#/compare", next: "/compare", storage: COMPARE, full: true },
  { id: "not-found", ref: "#/no-such-page", next: "/no-such-page" },
  // Interaction states (same user actions in both apps).
  { id: "mega-open", ref: "#/", next: "/", minW: 760, act: async (page) => { await page.getByRole("button", { name: "Laptops", exact: true }).click(); await page.getByText(/^View all \d+ products/).waitFor(); } },
  { id: "search-open", ref: "#/", next: "/", act: async (page) => {
      await page.getByRole("button", { name: /^(Search model, processor, RAM|Search)$/ }).filter({ visible: true }).first().click();
      await page.getByRole("textbox", { name: "Search laptops" }).fill("thinkpad");
      await page.getByRole("button", { name: /^See all \d+ results$/ }).waitFor();
      await page.waitForTimeout(300);
    } },
  { id: "mnav-open", ref: "#/", next: "/", maxW: 759, act: async (page) => { await page.getByRole("button", { name: "Open menu" }).click(); await page.getByRole("navigation", { name: "Mobile" }).waitFor(); } },
  { id: "drawer-open", ref: "#/", next: "/", storage: CART, act: async (page) => { await page.getByRole("button", { name: "Open cart" }).click(); await page.getByRole("dialog", { name: "Cart" }).getByText("Subtotal").waitFor(); } },
];

const localChromium = path.join(os.homedir(), "AppData", "Local", "ms-playwright", "chromium-1248", "chrome-win64", "chrome.exe");

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const imgs = [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight * 1.5);
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); }))));
  });
  await page.waitForTimeout(400); // one paint after fonts/images; animations are disabled via reduced motion
}

async function shoot(browser, url, vp, scene, file, side) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "light" });
  const page = await ctx.newPage();
  await page.addInitScript((seed) => {
    try {
      if (sessionStorage.getItem("lh-seeded")) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, v);
      sessionStorage.setItem("lh-seeded", "1");
    } catch {}
  }, scene.storage ? scene.storage[side] : null);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await settle(page);
  if (scene.scroll) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY); }, scene.scroll);
    await settle(page);
  }
  if (scene.full) {
    // Force every image to load (lazy images far below the fold may never start), then capture from the top.
    await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager")));
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
    });
    await settle(page);
    // Wait until every image has decoded (or definitively failed); CDN latency varies run to run.
    const pending = await page.evaluate(async () => {
      const wait = (i) => (i.complete && i.naturalWidth ? i.decode().catch(() => {}) : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); setTimeout(r, 30000); }));
      await Promise.all([...document.images].map(wait));
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      return [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.slice(-40));
    });
    if (pending.length) console.log(`  ${pending.length} image(s) did not load:`, pending.slice(0, 3));
    await page.waitForTimeout(300);
  }
  if (scene.act) {
    await scene.act(page);
    await settle(page);
  }
  await page.screenshot({ path: file, animations: "disabled", caret: "hide", fullPage: !!scene.full });
  const geo = await page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    return { header: q("header"), h1: q("h1"), footer: q("footer"), docH: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > innerWidth };
  });
  await ctx.close();
  return geo;
}

function diff(a, b, out) {
  const A = PNG.sync.read(fs.readFileSync(a));
  const B = PNG.sync.read(fs.readFileSync(b));
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const crop = (img) => { if (img.width === w && img.height === h) return img; const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
  const D = new PNG({ width: w, height: h });
  const n = pixelmatch(crop(A).data, crop(B).data, D.data, w, h, { threshold: 0.1, includeAA: false });
  fs.writeFileSync(out, PNG.sync.write(D));
  return { diffPixels: n, diffPct: +((100 * n) / (w * h)).toFixed(2) };
}

const only = arg("only", "");
const vpArg = arg("vp", "");
const vps = vpArg ? vpArg.split(",").map((s) => s.split("x").map(Number)) : VIEWPORTS;
const scenes = SCENES.filter((s) => !only || only.split(",").includes(s.id));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || localChromium });
const resultsFile = path.join(OUT, `results-${arg("group", "main")}.json`);
const results = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, "utf8")) : {};
for (const scene of scenes) {
  const dir = path.join(OUT, scene.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const vp of vps) {
    if ((scene.minW && vp[0] < scene.minW) || (scene.maxW && vp[0] > scene.maxW)) continue;
    const tag = `${vp[0]}x${vp[1]}`;
    const f = (k) => path.join(dir, `${tag}-${k}.png`);
    try {
      const refGeo = await shoot(browser, `${REF_PAGE}${scene.ref}`, vp, scene, f("ref"), "ref");
      const nextGeo = await shoot(browser, `${NEXT}${scene.next}`, vp, scene, f("next"), "next");
      const d = diff(f("ref"), f("next"), f("diff"));
      results[`${scene.id}@${tag}`] = { ...d, ref: refGeo, next: nextGeo, at: new Date().toISOString() };
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
      console.log(`${scene.id.padEnd(20)} ${tag.padEnd(10)} diff ${String(d.diffPct).padStart(6)}%  hdr ref ${JSON.stringify(refGeo.header)} next ${JSON.stringify(nextGeo.header)}  docH ${refGeo.docH}/${nextGeo.docH}${nextGeo.overflowX ? "  OVERFLOW-X" : ""}`);
    } catch (e) {
      console.log(`${scene.id} ${tag} ERROR ${e.message.split("\n")[0]}`);
      results[`${scene.id}@${tag}`] = { error: e.message.split("\n")[0] };
    }
  }
}
fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
await browser.close();
