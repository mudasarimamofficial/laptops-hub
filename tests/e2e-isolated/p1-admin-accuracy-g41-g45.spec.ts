/**
 * G41 / G45 / help accuracy on the ISOLATED stack: Help, Overview and Settings describe the real ordering state (taken
 * from the same readiness check as the COD panel) instead of hard-coded "COD is live" / "COD stays off" text; Help only
 * offers tasks the signed-in role can open; the Media page no longer claims rights status hides images.
 */
import { expect, test, type Browser } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
type Role = "owner" | "editor" | "manager" | "fulfillment";

async function as(browser: Browser, role: Role) {
  const ctx = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
  return { ctx, page };
}

test.beforeAll(async () => {
  await assertLocalOnly("admin accuracy");
});

test("owner: Help ordering status agrees with the COD readiness panel; no contradictory COD text anywhere", async ({ browser }) => {
  const { ctx, page } = await as(browser, "owner");
  await page.goto("/admin");
  const panelStatus = (await page.getByTestId("checkout-readiness-status").innerText()).toLowerCase();
  const open = !/closed|not open|blocked/.test(panelStatus);
  await expect(page.locator("body")).not.toContainText("COD is live");
  // The store-setting gate is an owner decision: no link to Settings, which has no such control.
  const dbGate = page.locator('[data-gate="db_setting"]');
  if ((await dbGate.getAttribute("data-state")) !== "pass") {
    await expect(dbGate.getByRole("link")).toHaveCount(0);
    await expect(dbGate).toContainText("owner decision");
  }

  await page.goto("/admin/help");
  await expect(page.getByTestId("help-ordering-status")).toContainText(open ? "is open right now" : "is closed right now");
  await expect(page.locator("body")).not.toContainText("COD stays off");
  for (const label of ["Confirm, ship and close orders", "Import products from a CSV", "Invite staff and set roles", "See who changed what"]) {
    await expect(page.getByTestId("help-tasks").getByRole("link", { name: label })).toBeVisible();
  }
  // Every task link opens its screen for the owner (no 404 / forbidden).
  for (const href of await page.getByTestId("help-tasks").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
    const r = await page.request.get(href);
    expect(r.status(), href).toBe(200);
    expect(r.url(), href).not.toMatch(/forbidden|login/);
  }

  await page.goto("/admin/settings");
  await expect(page.locator("body")).not.toContainText("Production COD stays off");
  await expect(page.locator("body")).toContainText("does not open or close customer ordering");

  await page.goto("/admin/media");
  await expect(page.locator("body")).not.toContainText("Customers never see pending");
  await expect(page.locator("body")).toContainText("does not hide");
  await ctx.close();
});

test("Help offers each role only tasks its pages admit, and each offered link opens", async ({ browser }) => {
  const expectations: Record<Exclude<Role, "owner">, { shown: string[]; hidden: string[] }> = {
    fulfillment: { shown: ["Confirm, ship and close orders"], hidden: ["Add or edit a product", "Import products from a CSV", "Invite staff and set roles", "Change the homepage and site text"] },
    editor: { shown: ["Add or edit a product", "Change the homepage and site text"], hidden: ["Import products from a CSV", "Invite staff and set roles", "See who changed what", "Confirm, ship and close orders"] },
    manager: { shown: ["Import products from a CSV", "Edit store pages and policies", "Confirm, ship and close orders"], hidden: ["Invite staff and set roles", "See who changed what"] },
  };
  for (const [role, exp] of Object.entries(expectations) as [Exclude<Role, "owner">, (typeof expectations)["editor"]][]) {
    const { ctx, page } = await as(browser, role);
    await page.goto("/admin/help");
    const tasks = page.getByTestId("help-tasks");
    for (const l of exp.shown) await expect(tasks.getByRole("link", { name: l }), `${role} sees ${l}`).toBeVisible();
    for (const l of exp.hidden) await expect(tasks.getByRole("link", { name: l }), `${role} not ${l}`).toHaveCount(0);
    for (const href of await tasks.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
      const r = await page.request.get(href);
      expect(r.url(), `${role} ${href}`).not.toMatch(/forbidden|login/);
    }
    await ctx.close();
  }
});
