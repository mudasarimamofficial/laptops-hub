/**
 * Cross-browser storefront layout (isolated stack): every public page renders without uncaught errors and without
 * horizontal page scroll at 360/390/768/1024/1280/1440 (desktop projects) or the device viewport (mobile projects).
 * Screenshots go to docs/evidence/cross-browser/<project>/.
 */
import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const PAGES: [string, string, string?][] = [
  ["home", "/"],
  ["collection", "/collections/all"],
  ["pdp", `/products/${fx.products[0].handle}`],
  ["search", "/search?q=dell"],
  ["compare", "/compare"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["track", "/track-order"],
  // Gated until the owner approves their copy (no invented content): 404 is the correct public state.
  ["guides", "/guides", "gated"],
  ["contact", "/pages/contact", "gated"],
  ["admin-login", "/admin/login"],
];
const WIDTHS = [360, 390, 768, 1024, 1280, 1440];

for (const [name, url, gated] of PAGES) {
  test(`layout: ${name}`, async ({ page, isMobile }, info) => {
    const errors: string[] = [];
    // WebKit reports the router's prefetches it cancels when the test navigates away as
    // "…?_rsc=… due to access control checks." — those are aborted requests, not page errors.
    page.on("pageerror", (e) => { if (!/_rsc=.*due to access control checks/.test(e.message)) errors.push(e.message); });
    const dir = path.join("docs/evidence/cross-browser", info.project.name);
    fs.mkdirSync(dir, { recursive: true });
    const widths = isMobile ? [page.viewportSize()!.width] : WIDTHS;
    for (const w of widths) {
      if (!isMobile) await page.setViewportSize({ width: w, height: 900 });
      // Distinct URL per width: Firefox can otherwise race a repeat goto with the router's own
      // same-URL history update from the previous load (the page itself renders correctly either way).
      const res = await page.goto(`${url}${url.includes("?") ? "&" : "?"}vw=${w}`, { waitUntil: "load" });
      if (gated) expect([200, 404], `${url} status`).toContain(res?.status());
      else expect(res?.status(), `${url} status`).toBeLessThan(400);
      await expect(page.locator("main, form").first()).toBeVisible({ timeout: 15_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${url} horizontal overflow at ${w}px`).toBeLessThanOrEqual(1);
      if (w === 390 || w === 1440 || isMobile) await page.screenshot({ path: path.join(dir, `${name}-${w}.png`) });
    }
    expect(errors, `uncaught errors on ${url}`).toEqual([]);
  });
}
