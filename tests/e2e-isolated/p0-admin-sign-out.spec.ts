/**
 * Admin sign-out on the ISOLATED stack: visible in the shell for every role, ends the session on the server (the old
 * cookies stop working when replayed), lands on the sign-in page with a confirmation, and cannot be triggered
 * cross-site.
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));

async function signIn(page: Page, who: "owner" | "editor" | "fulfillment") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[who].email);
  await page.getByLabel("Password").fill(fx.staff[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

test.describe("P0: admin sign-out (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("admin sign-out");
  });

  for (const who of ["owner", "editor", "fulfillment"] as const) {
    test(`${who}: sign out ends the session; replayed cookies are refused`, async ({ page, browser }) => {
      await signIn(page, who);
      await expect(page.getByRole("complementary", { name: "Admin navigation" }).getByText(fx.staff[who].email)).toBeVisible(); // current account shown in the shell
      const before = await page.context().cookies();
      expect(before.some((c) => c.name.startsWith("sb-"))).toBe(true);

      await page.getByTestId("admin-sign-out").click();
      await page.waitForURL(/\/admin\/login\?signed_out=1$/);
      await expect(page.getByRole("status").filter({ hasText: "You are signed out on this device." })).toBeVisible();
      expect((await page.context().cookies()).some((c) => c.name.startsWith("sb-") && c.value)).toBe(false);
      await page.goto("/admin/orders");
      await expect(page).toHaveURL(/\/admin\/login/);

      // The session itself is gone on the server: putting the old cookies back does not sign anyone in.
      const replay = await browser.newContext({ baseURL: page.url().replace(/\/admin.*$/, "") });
      await replay.addCookies(before);
      const r = await replay.newPage();
      await r.goto("/admin");
      await expect(r).toHaveURL(/\/admin\/login/);
      expect((await r.request.get("/api/admin/search?q=LH")).status()).toBe(401);
      await replay.close();
    });
  }

  test("cross-site sign-out is refused", async ({ page }) => {
    await signIn(page, "editor");
    const res = await page.request.post("/api/admin/account/sign-out", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
    expect(res.status()).toBe(403);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/); // still signed in
  });
});
