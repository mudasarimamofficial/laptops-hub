/**
 * VIS-001 / VIS-002 / VIS-003 / VIS-004 (2026-11-27) on the ISOLATED stack.
 *
 * Root cause: the homepage map after the footer was `position: sticky; bottom: 0` from the first frame. Wherever it was
 * taller than the space under the header (every phone, short or zoomed desktop windows) its top sat behind the
 * translucent blurred header and over the non-positioned promotion bar, so Google's map UI showed at the top of the
 * page and covered half of the promotion text.
 *
 * These checks use geometry and hit-testing (not screenshots alone), on a fresh load and after scroll cycles that load
 * the Google iframe: nothing from the map may sit under the promotion bar or the header, the promotion text and its
 * link must be readable and clickable, and on phones the card must follow the map in normal flow.
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const OUT = "test-results/ui-map-header";
test.beforeAll(async () => {
  await assertLocalOnly("ui map/header compositing");
  fs.mkdirSync(OUT, { recursive: true });
});

type Probe = {
  mapTop: number;
  headerBottom: number;
  pinned: boolean;
  mapUnderTop: string[];
  promo: null | { clipped: boolean; linkHit: boolean; ctaInside: boolean };
  headerAlpha: number;
};

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const map = document.querySelector('[data-testid="store-map"]') as HTMLElement;
    const header = document.querySelector("header") as HTMLElement;
    const promo = document.querySelector(".lh-promo-bar") as HTMLElement | null;
    const hb = header.getBoundingClientRect();
    // Hit-test a grid of points over the promotion bar and the header: the topmost element there must never be the
    // map, and the map must not even be painted underneath (it would show through the translucent header).
    const top = promo ? Math.min(promo.getBoundingClientRect().top, hb.top) : hb.top;
    const under: string[] = [];
    for (let y = Math.max(0, top + 2); y < hb.bottom - 1; y += 12) {
      for (let x = 4; x < innerWidth; x += Math.max(24, Math.floor(innerWidth / 16))) {
        for (const el of document.elementsFromPoint(x, y)) if (map.contains(el)) under.push(`${x},${Math.round(y)}:${el.tagName}`);
      }
    }
    let promoInfo: Probe["promo"] = null;
    if (promo) {
      const link = promo.querySelector("a") as HTMLAnchorElement;
      const cta = promo.querySelector(".lh-promo-cta") as HTMLElement;
      const pr = promo.getBoundingClientRect();
      const cr = cta.getBoundingClientRect();
      // The link wraps onto centred lines: hit-test the middle of its first line box, not the union rectangle.
      const first = link.getClientRects()[0];
      const hit = document.elementFromPoint(first.left + first.width / 2, first.top + first.height / 2);
      promoInfo = {
        // An inline link has clientWidth 0 by spec: check the bar, and that every line box of the link fits inside it.
        clipped:
          promo.scrollWidth > promo.clientWidth + 1 ||
          [...link.getClientRects()].some((r) => r.left < pr.left - 1 || r.right > pr.right + 1 || r.bottom > pr.bottom + 1),
        linkHit: !!hit && (hit === link || link.contains(hit)),
        ctaInside: cr.left >= pr.left - 1 && cr.right <= pr.right + 1 && cr.top >= pr.top - 1 && cr.bottom <= pr.bottom + 1,
      };
    }
    const bg = getComputedStyle(header).backgroundColor;
    const alpha = Number((bg.match(/rgba?\(([^)]+)\)/)?.[1].split(",")[3] ?? "1").trim());
    return {
      mapTop: Math.round(map.getBoundingClientRect().top),
      headerBottom: Math.round(hb.bottom),
      pinned: getComputedStyle(map).position === "sticky",
      mapUnderTop: under.slice(0, 5),
      promo: promoInfo,
      headerAlpha: alpha,
    };
  });
}

async function scrollCycle(page: Page) {
  for (const f of [0.25, 0.5, 0.9, 1]) {
    await page.evaluate((k) => window.scrollTo(0, k * (document.documentElement.scrollHeight - innerHeight)), f);
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId("store-map-iframe")).toHaveCount(1); // Google iframe mounted near the end
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

const VIEWPORTS = [
  { w: 320, h: 568, phone: true },
  { w: 375, h: 667, phone: true },
  { w: 390, h: 844, phone: true },
  { w: 430, h: 932, phone: true },
  { w: 844, h: 390, phone: true }, // landscape phone: short, so stacked and not pinned
  { w: 768, h: 1024, phone: false },
  { w: 1366, h: 768, phone: false },
  { w: 1918, h: 542, phone: false }, // short desktop window: not pinned
  { w: 1440, h: 900, phone: false },
];

for (const vp of VIEWPORTS) {
  test(`${vp.w}x${vp.h}: no map under the promo bar or header (fresh load and after 2 scroll cycles)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("/");
    await expect(page.getByTestId("store-map")).toHaveCount(1);
    await expect(page.getByTestId("store-map-iframe")).toHaveCount(0); // never part of the initial load

    const fresh = await probe(page);
    expect(fresh.mapUnderTop, "map painted under promo/header on a fresh load").toEqual([]);
    if (fresh.pinned) expect(fresh.mapTop, "a pinned map must start below the header").toBeGreaterThanOrEqual(fresh.headerBottom);
    if (vp.w < 760) expect(fresh.headerAlpha, "phone header is nearly opaque").toBeGreaterThanOrEqual(0.95);
    if (fresh.promo) {
      expect(fresh.promo.clipped, "promotion text clipped").toBe(false);
      expect(fresh.promo.ctaInside, "promotion button text inside the bar").toBe(true);
      expect(fresh.promo.linkHit, "promotion link not covered").toBe(true);
    }
    // Pinning is only allowed where the whole map fits below the header.
    if (vp.w < 761 || vp.h < 700) expect(fresh.pinned).toBe(false);

    for (let cycle = 1; cycle <= 2; cycle++) {
      await scrollCycle(page);
      const again = await probe(page);
      expect(again.mapUnderTop, `map under promo/header after cycle ${cycle}`).toEqual([]);
      if (again.promo) expect(again.promo.linkHit).toBe(true);
    }
    await page.screenshot({ path: `${OUT}/top-after-cycles-${vp.w}x${vp.h}.png` });
  });
}

test("phones: map first, compact card below it in normal flow, clear of the WhatsApp button", async ({ page }) => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/", { waitUntil: "load" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    // Count the element in the DOM: Firefox locators wait for the Google iframe's own cross-origin navigation to finish.
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('[data-testid="store-map-iframe"]').length), { timeout: 15_000 })
      .toBe(1);
    const g = await page.evaluate(() => {
      const section = document.querySelector('[data-testid="store-map"]') as HTMLElement;
      const frame = (document.querySelector('[data-testid="store-map-iframe"]') as HTMLElement).getBoundingClientRect();
      const panel = (section.querySelector("#store-map-title") as HTMLElement).closest("div") as HTMLElement;
      const pr = panel.getBoundingClientRect();
      const open = (document.querySelector('[data-testid="store-map-open"]') as HTMLElement).getBoundingClientRect();
      const wa = document.querySelector('[data-testid="whatsapp-float"]')?.getBoundingClientRect() ?? null;
      const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        sectionPos: getComputedStyle(section).position,
        panelPos: getComputedStyle(panel).position,
        panelBelowMap: pr.top >= frame.bottom - 1,
        frameH: Math.round(frame.height),
        panelInside: pr.left >= 0 && pr.right <= innerWidth,
        openCoveredByWa: wa ? overlap(open, wa) : false,
        panelOpacity: Number(getComputedStyle(panel).opacity),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(g.sectionPos, `${w}x${h}`).not.toBe("sticky");
    expect(g.panelPos, `${w}x${h}`).not.toBe("absolute");
    expect(g.panelBelowMap, `${w}x${h} card below the map`).toBe(true);
    expect(g.frameH).toBeGreaterThanOrEqual(270);
    expect(g.frameH).toBeLessThanOrEqual(390);
    expect(g.panelInside).toBe(true);
    expect(g.panelOpacity).toBe(1);
    expect(g.openCoveredByWa, `${w}x${h} Open in Google Maps clear of WhatsApp`).toBe(false);
    expect(g.overflowX).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${OUT}/phone-map-end-${w}x${h}.png` });
  }
});

test("phones: focusing the map link does not jump the page to the end", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - 2 * innerHeight));
  const before = await page.evaluate(() => window.scrollY);
  await page.getByTestId("store-map-open").focus();
  const after = await page.evaluate(() => ({ y: window.scrollY, end: document.documentElement.scrollHeight - innerHeight }));
  // The browser may scroll the link into view, but the old "jump to the very end" handler must not run when unpinned.
  const r = await page.getByTestId("store-map-open").boundingBox();
  expect(r && r.y >= 0 && r.y + r.height <= 844).toBe(true);
  expect(after.y >= before).toBe(true);
});
