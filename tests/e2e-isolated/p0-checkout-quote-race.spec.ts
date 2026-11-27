/**
 * Checkout quote race (the intermittent "We do not currently deliver COD…" miss): the page asks the server for a
 * quote after each address change. A slow answer for an EARLIER address must never replace the answer for the
 * address now on screen. Here the quote for the served zone is held back until after the unserved address has been
 * entered and answered, which reproduces the ordering deterministically.
 */
import { expect, test } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { formatPkr } from "../../src/lib/money";

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const P = fx.products[0];

test("a late quote for an earlier address never overwrites the current address's answer", async ({ page }) => {
  await assertLocalOnly("checkout quote race");
  let heldServed = 0;
  let unservedAnswered = false;
  await page.route("**/api/checkout/quote", async (route) => {
    const body = route.request().postDataJSON() as { address?: { city?: string; province?: string } };
    const response = await route.fetch();
    if (body.address?.province === fx.zone.province) {
      // Served address: answer only after the unserved one has been answered (or 4 s at most).
      heldServed += 1;
      for (let i = 0; i < 40 && !unservedAnswered; i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 300));
    } else {
      unservedAnswered = true;
    }
    await route.fulfill({ response });
  });

  await page.goto(`/products/${P.handle}`);
  await page.getByRole("button", { name: /Add to cart/ }).first().click();
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-form")).toHaveAttribute("data-ready", "true");
  // Served address first (the fixture zone), held in flight; then an unserved address.
  await page.getByLabel("City").fill(fx.zone.city);
  await page.getByLabel("Province").selectOption(fx.zone.province);
  await expect.poll(() => heldServed, { timeout: 5_000 }).toBeGreaterThan(0);
  await page.getByLabel("City").fill("Gwadar");
  await page.getByLabel("Province").selectOption("Balochistan");

  await expect(page.getByText(/do not currently deliver COD/i)).toBeVisible();
  // The held answer for the earlier address arrives now. Watch every 25 ms for 2.5 s: the served zone's fees must
  // never appear, not even briefly, and the "not delivered" message must never disappear.
  const fees = page.getByText(`Delivery ${formatPkr(fx.zone.flatFeePaisa)} · COD fee ${formatPkr(fx.zone.codFeePaisa)}`);
  const notServed = page.getByText(/do not currently deliver COD/i);
  const wrong: string[] = [];
  for (let i = 0; i < 100; i++) {
    if ((await fees.count()) > 0) wrong.push(`fees shown at ${i * 25}ms`);
    if ((await notServed.count()) === 0) wrong.push(`message gone at ${i * 25}ms`);
    await page.waitForTimeout(25);
  }
  expect(wrong, wrong.slice(0, 5).join("; ")).toEqual([]);
  await expect(notServed).toBeVisible();
  // No quote for the unserved address: the cash line shows "—" and the served zone's fees are not shown.
  await expect(page.getByText("Cash due: —")).toBeVisible();
  await expect(page.getByText(`Delivery ${formatPkr(fx.zone.flatFeePaisa)} · COD fee ${formatPkr(fx.zone.codFeePaisa)}`)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Place COD order" })).toBeDisabled();
});
