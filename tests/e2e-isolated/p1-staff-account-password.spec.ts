/**
 * G23: every staff role can change its own password from Admin → Your account (not only owner/admin/manager in
 * Settings). Runs on the ISOLATED stack only; the fixture password is put back afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("account journeys need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const editor = fx.staff.editor as { email: string; password: string; id: string };
const fulfillment = fx.staff.fulfillment as { email: string; password: string; id: string };
const NEW_PASSWORD = `Acct-${randomUUID().slice(0, 8)}-Pass!`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.serial("staff account page (G23, isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("staff account journeys");
    const { error } = await sb.from("rate_limit_buckets").delete().like("bucket_key", "change-password:%");
    expect(error, "clear local change-password counters").toBeNull();
  });
  test.afterAll(async () => {
    await sb.auth.admin.updateUserById(editor.id, { password: editor.password });
  });

  test("fulfillment staff can open Your account from the menu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, fulfillment.email, fulfillment.password);
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.getByTestId("admin-account-link").click();
    await page.waitForURL(/\/admin\/account$/);
    await expect(page.getByRole("heading", { name: "Your account", level: 1 })).toBeVisible();
    await expect(page.getByTestId("account-details")).toContainText(fulfillment.email);
    await expect(page.getByTestId("change-password-form")).toBeVisible();
  });

  test("editor changes their own password; the old one stops working, the new one signs in", async ({ page, browser }) => {
    await signIn(page, editor.email, editor.password);
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.goto("/admin/account");
    const form = page.getByTestId("change-password-form");
    // Wrong current password is refused and changes nothing.
    await form.getByLabel("Current password").fill(`${editor.password}-wrong`);
    await form.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await form.getByLabel("Repeat new password").fill(NEW_PASSWORD);
    await form.getByRole("button", { name: "Update password" }).click();
    await expect(form.getByRole("alert")).toHaveText("Current password is incorrect.");

    await form.getByLabel("Current password").fill(editor.password);
    await form.getByRole("button", { name: "Update password" }).click();
    await expect(form.getByRole("status")).toHaveText("Password updated.");
    // Still signed in on this device.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your account", level: 1 })).toBeVisible();

    const fresh = await browser.newContext();
    const p2 = await fresh.newPage();
    await signIn(p2, editor.email, editor.password);
    await expect(p2).toHaveURL(/\/admin\/login/);
    await signIn(p2, editor.email, NEW_PASSWORD);
    await p2.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await fresh.close();

    const { data } = await sb.from("admin_memberships").select("role, is_active").eq("user_id", editor.id).single();
    expect(data).toEqual({ role: "editor", is_active: true });
  });
});
