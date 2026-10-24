/**
 * Forms must not submit before the page's JavaScript has loaded: a native submit would reload the page as a GET with
 * the typed values in the URL (customer details in logs/history) and save nothing — the cause of shipping zones
 * "entered but not saved" on Production (2026-10-24). JavaScript is disabled to stand in for "not hydrated yet".
 */
import { expect, test, type Browser } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));

async function noJsAsManager(browser: Browser) {
  const js = await browser.newContext();
  const p = await js.newPage();
  await p.goto("/admin/login");
  await p.getByLabel("Email").fill(fx.staff.manager.email);
  await p.getByLabel("Password").fill(fx.staff.manager.password);
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL(/\/admin(\?|$|\/(?!login))/);
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  await ctx.addCookies(await js.cookies());
  await js.close();
  return ctx;
}

test.describe("forms before hydration (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("pre-hydration checks");
  });

  test("customer forms: track order and homepage inquiry cannot submit and post when they do", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/track-order");
    const track = page.locator("form").filter({ has: page.locator('button[type="submit"]') }).first();
    await expect(track.locator('button[type="submit"]')).toBeDisabled();
    await expect(track).toHaveAttribute("method", "post");
    await page.goto("/");
    const ask = page.locator('form[aria-label="Send an inquiry to Laptops HUB"]');
    await expect(ask.locator('button[type="submit"]')).toBeDisabled();
    await expect(ask).toHaveAttribute("method", "post");
    await ctx.close();
  });

  test("admin forms: shipping zone, product and content edits cannot submit", async ({ browser }) => {
    const ctx = await noJsAsManager(browser);
    const page = await ctx.newPage();
    for (const path of ["/admin/settings", `/admin/products/${fx.products[0].handle}`, "/admin/content"]) {
      await page.goto(path);
      const buttons = page.locator('main form[method="post"] button[type="submit"]');
      expect(await buttons.count(), path).toBeGreaterThan(0);
      for (const b of await buttons.all()) await expect(b, path).toBeDisabled();
      expect(await page.locator('main form:not([method="post"]):not([method="get"])').count(), `${path}: forms without method`).toBe(0);
    }
    await ctx.close();
  });
});
