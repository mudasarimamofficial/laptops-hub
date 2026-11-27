/**
 * G27/G28 on the ISOLATED stack: each role sees only the admin links its pages admit, and controls the server would
 * refuse are disabled with an explanation instead of failing with 403. Server authorization is unchanged (asserted).
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
  return { ctx, page, sidebar: page.getByRole("complementary", { name: "Admin navigation" }) };
}

test.beforeAll(async () => {
  await assertLocalOnly("role ux");
});

test("editor: no Import link (page refuses editors); Publish/Restore disabled with a reason; server still refuses", async ({ browser }) => {
  const { ctx, page, sidebar } = await as(browser, "editor");
  await page.goto("/admin/products");
  await expect(sidebar.getByRole("link", { name: "Export", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Import", exact: true })).toHaveCount(0);
  expect((await page.request.get("/admin/products/import")).url()).not.toMatch(/\/admin\/products\/import$/);

  await page.goto("/admin/online-store");
  const publish = page.getByTestId("theme-publish");
  await expect(publish).toBeDisabled();
  await expect(page.getByTestId("theme-publish-role-note")).toContainText("Only an owner or admin can publish or restore versions");
  const r = await page.request.post("/api/admin/theme/homepage/publish", { headers: { origin: ORIGIN }, data: { confirmPublish: true } });
  expect(r.status()).toBe(403);
  await ctx.close();
});

test("manager: Content link shown (legal approval lives there) and the page opens; Blog/Reels not offered", async ({ browser }) => {
  const { ctx, page, sidebar } = await as(browser, "manager");
  await expect(sidebar.getByRole("link", { name: "Content", exact: true })).toBeVisible();
  await sidebar.getByRole("link", { name: "Content", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Pages", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Blog", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Generation reels", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Import", exact: true })).toHaveCount(0); // Products not active here
  await ctx.close();
});

test("fulfillment: no Customize or Navigation links; owner keeps Publish enabled", async ({ browser }) => {
  const f = await as(browser, "fulfillment");
  await expect(f.sidebar.getByRole("link", { name: "Customize", exact: true })).toHaveCount(0);
  await expect(f.sidebar.getByRole("link", { name: "Navigation", exact: true })).toHaveCount(0);
  await f.ctx.close();

  const o = await as(browser, "owner");
  await o.page.goto("/admin/online-store");
  await expect(o.page.getByTestId("theme-publish-role-note")).toHaveCount(0);
  await expect(o.page.getByRole("button", { name: "Publish to live site" })).toBeVisible();
  await o.ctx.close();
});
