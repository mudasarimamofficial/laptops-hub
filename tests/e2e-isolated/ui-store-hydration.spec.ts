/**
 * HYD-001 (2026-11-27) on the ISOLATED stack. The cart and compare stores used `() => memory` as the
 * useSyncExternalStore server snapshot. `memory` changes as soon as any component reads localStorage, so a
 * <Suspense> boundary that hydrated later (the checkout form) hydrated with the real cart against server HTML built
 * from an empty one: React #418, the form was re-created, and a city typed right after load was lost (no quote).
 * Seen as the intermittent "We do not currently deliver COD…" failure in launch-journey.
 *
 * CPU throttling (Chromium CDP) makes the boundaries hydrate in separate passes; before the fix this reproduced on
 * 5 of 8 checkout loads. Read-only: page loads, localStorage and the quote endpoint only — no order is placed.
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.beforeAll(async () => {
  await assertLocalOnly("store hydration");
});

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const P = fx.products[0];
const LOADS = 6;

async function seedStores(page: Page) {
  await page.addInitScript(
    ({ line, handle }) => {
      localStorage.setItem("lh-cart-v1", JSON.stringify({ lines: [line] }));
      localStorage.setItem("lh-compare-v1", JSON.stringify({ handles: [handle] }));
    },
    {
      line: { variantId: P.variantId, handle: P.handle, title: P.title, unitPricePaisa: P.pricePaisa, quantity: 1, maxPerOrder: P.max },
      handle: P.handle,
    },
  );
}

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

for (const path of ["/checkout", "/compare", "/cart"]) {
  test(`${path} with a saved cart/compare hydrates without a mismatch (${LOADS} throttled loads)`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CPU throttling needs Chromium CDP");
    await seedStores(page);
    await throttle(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (let i = 0; i < LOADS; i++) {
      await page.goto(path, { waitUntil: "load" });
      await page.waitForTimeout(1500);
    }
    expect(errors.filter((m) => /#418|#423|#425|Hydration/i.test(m))).toEqual([]);
  });
}

