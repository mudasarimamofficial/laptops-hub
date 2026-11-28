/**
 * PERF-001 (2026-11-28) on the ISOLATED stack. On phones the collection grid is one column, so the first card's
 * photo is the LCP element. Every card photo was `loading="lazy"` with no priority hint: Lighthouse reported the LCP
 * request as "not discoverable in the initial document", and the browser started it only after layout (about 1.3 s
 * into an unthrottled load).
 *
 * The first card now loads eagerly at high priority, straight from the server HTML. Every other card stays lazy, so
 * no extra bytes compete with it. Read-only: page loads only.
 */
import { expect, test } from "@playwright/test";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.beforeAll(async () => {
  await assertLocalOnly("collection LCP priority");
});

const cardImgs = /<article class="v5-card"[\s\S]*?<img\b[^>]*>/g;

for (const path of ["/collections/all", "/search?q=dell"]) {
  test(`${path}: only the first card photo is eager + high priority in the server HTML`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    const imgs = [...html.matchAll(cardImgs)].map((m) => m[0].slice(m[0].lastIndexOf("<img")));
    expect(imgs.length, "product cards with photos in the server HTML").toBeGreaterThan(0);
    expect(imgs[0]).toMatch(/loading="eager"/);
    expect(imgs[0]).toMatch(/fetchPriority="high"|fetchpriority="high"/i);
    for (const tag of imgs.slice(1)) {
      expect(tag).toMatch(/loading="lazy"/);
      expect(tag).not.toMatch(/fetchpriority="high"/i);
    }
  });
}

test("phone: the first collection photo is the LCP element and is requested at high priority", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "LCP entries and request priority are Chromium-only");
  await page.setViewportSize({ width: 390, height: 844 });
  const priorities = new Map<string, string>();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", (e) => {
    if (e.type === "Image") priorities.set(e.request.url, e.request.initialPriority);
  });
  await page.goto("/collections/all");
  const first = page.locator("article.v5-card img").first();
  await expect(first).toBeVisible();
  await expect.poll(() => first.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  const src = await first.evaluate((el: HTMLImageElement) => el.currentSrc);
  expect(priorities.get(src), `priority of ${src}`).toBe("High");
  const lcpIsFirstCard = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        // Entries can arrive in several batches (card title text first, then the photo): keep the latest one.
        let last: (PerformanceEntry & { element?: Element }) | undefined;
        new PerformanceObserver((list) => {
          last = list.getEntries().at(-1) as typeof last;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve(!!last?.element && last.element === document.querySelector("article.v5-card img")), 1000);
      }),
  );
  expect(lcpIsFirstCard).toBe(true);
});
