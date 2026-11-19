/**
 * Native Auth SMTP / default-template landings put `#access_token&refresh_token&type=recovery`
 * on Site URL. AuthHashSessionBridge must exchange them into cookies and route to reset-password.
 * Isolated Supabase + Mailpit only — see docs/ISOLATED_TESTS.md.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { RECOVERY_WINDOW_SECONDS } from "../../src/lib/auth/recovery";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) {
  throw new Error("hash recovery bridge needs a local Supabase");
}
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function sessionTokensFor(email: string) {
  const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email });
  expect(error, `generateLink: ${error?.message}`).toBeNull();
  const props = data.properties!;
  const anon = createClient(SB_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const verify = await anon.auth.verifyOtp({ type: "recovery", token_hash: props.hashed_token! });
  expect(verify.error, `verifyOtp: ${verify.error?.message}`).toBeNull();
  return {
    access: verify.data.session!.access_token,
    refresh: verify.data.session!.refresh_token,
    email,
  };
}

async function landWithHash(page: Page, access: string, refresh: string, type = "recovery") {
  const hash = new URLSearchParams({
    access_token: access,
    refresh_token: refresh,
    type,
  }).toString();
  await page.goto(`/#${hash}`);
}

test.describe.serial("auth hash recovery bridge (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("hash recovery bridge");
  });

  test("valid recovery hash → cookies → /admin/reset-password form", async ({ page }) => {
    const editor = fx.staff.editor as { email: string };
    const { access, refresh, email } = await sessionTokensFor(editor.email);
    await landWithHash(page, access, refresh);
    await expect(page).toHaveURL(/\/admin\/reset-password$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    // Hash stripped from the address bar after exchange.
    expect(new URL(page.url()).hash).toBe("");
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name.includes("auth-token") || c.name.includes("sb-"))).toBeTruthy();
  });

  test("malformed / non-recovery hash does not open the reset form", async ({ page }) => {
    await page.goto("/#access_token=not-a-jwt&refresh_token=nope&type=recovery");
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/admin\/reset-password/);
    await page.goto("/#type=magiclink&access_token=x&refresh_token=y");
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/admin\/reset-password/);
  });

  test("used recovery session cannot open a fresh reset form after sign-out", async ({ page }) => {
    const manager = fx.staff.manager as { email: string };
    const { access, refresh } = await sessionTokensFor(manager.email);
    await landWithHash(page, access, refresh);
    await expect(page).toHaveURL(/\/admin\/reset-password$/, { timeout: 20_000 });
    await page.context().clearCookies();
    await page.goto("/admin/reset-password");
    await expect(page.locator("p[role=alert]")).toContainText("needs a valid reset link");
  });

  test("recovery-window constant matches product rule (15 minutes)", () => {
    expect(RECOVERY_WINDOW_SECONDS).toBe(15 * 60);
  });
});
