/**
 * Staff password recovery against the ISOLATED stack: local Supabase (emails captured by its Mailpit on :54324),
 * fixtures from scripts/test-fixtures/seed-isolated.mjs, the app on :3001. See docs/ISOLATED_TESTS.md.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("recovery journeys need a local Supabase");
const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const NEW_PASSWORD = `Fresh-${randomUUID().slice(0, 8)}-Pass!`;

async function mailFor(address: string, after: number) {
  for (let i = 0; i < 40; i++) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json();
    const msg = (r.messages || []).find((m: { Created: string }) => Date.parse(m.Created) >= after);
    if (msg) return (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { Text: string; HTML: string };
    await new Promise((res) => setTimeout(res, 500));
  }
  return null;
}
const countMail = async (address: string) =>
  ((await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json()).messages || []).length as number;
const linkIn = (m: { Text: string; HTML: string }) =>
  (m.HTML.match(/href="([^"]+)"/)?.[1] || m.Text.match(/https?:\/\/\S+/)?.[0] || "").replace(/&amp;/g, "&");

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
async function requestReset(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset staff password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If this email belongs to a staff account")).toBeVisible();
}
const api = (page: Page, path: string, data: unknown, ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`) =>
  page.request.post(path, { headers: { origin: new URL(page.url() || "http://127.0.0.1:3001").origin, "x-forwarded-for": ip }, data });
const membership = async (userId: string) =>
  (await sb.from("admin_memberships").select("role, is_active").eq("user_id", userId).single()).data;

test.describe.serial("staff password recovery (isolated)", () => {
  const manager = fx.staff.manager as { email: string; password: string; id: string };

  test("full recovery: email link → new password → all sessions ended; UID, role and status unchanged", async ({ page, browser }) => {
    const before = await membership(manager.id);
    // A second device signed in with the old password.
    const other = await (browser as Browser).newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, manager.email, manager.password);
    await otherPage.waitForURL(/\/admin$/);

    const t0 = Date.now() - 1000;
    await requestReset(page, manager.email);
    const mail = await mailFor(manager.email, t0);
    expect(mail, "recovery email delivered to the local mail catcher").toBeTruthy();
    await page.goto(linkIn(mail!));
    await expect(page).toHaveURL(/\/admin\/reset-password$/);
    await expect(page.getByText(manager.email)).toBeVisible();

    // Rules enforced by the server.
    await page.getByLabel("New password", { exact: true }).fill("short-pass");
    await page.getByLabel("Repeat new password").fill("short-pass");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("at least 12");
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Repeat new password").fill(`${NEW_PASSWORD}x`);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("do not match");

    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Repeat new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?reset=1/, { timeout: 15_000 });
    await expect(page.getByText("Password changed. All devices were signed out")).toBeVisible();

    // The other device is signed out.
    await otherPage.goto("/admin");
    await expect(otherPage).toHaveURL(/\/admin\/login/);
    await other.close();

    // Old password refused, new one works; same user, same role and status; audit entry written.
    await signIn(page, manager.email, manager.password);
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
    await signIn(page, manager.email, NEW_PASSWORD);
    await page.waitForURL(/\/admin$/);
    const { data: u } = await sb.auth.admin.getUserById(manager.id);
    expect(u.user?.email).toBe(manager.email);
    expect(await membership(manager.id)).toEqual(before);
    const { count } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "auth.password_reset").eq("entity_id", manager.id);
    expect(count).toBe(1);

    // The used link cannot be reused.
    const ctx = await (browser as Browser).newContext();
    const p2 = await ctx.newPage();
    await p2.goto(linkIn(mail!));
    await expect(p2).toHaveURL(/\/admin\/forgot-password\?link=invalid/);
    await expect(p2.locator("p[role=alert]")).toContainText("invalid or has expired");
    await ctx.close();
  });

  test("token_hash link (recommended email template) works on another device", async ({ page }) => {
    const editor = fx.staff.editor as { email: string; id: string };
    const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email: editor.email });
    expect(error).toBeNull();
    await page.goto(`/admin/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery`);
    await expect(page).toHaveURL(/\/admin\/reset-password$/);
    await expect(page.getByText(editor.email)).toBeVisible();
  });

  test("recovery never grants access: deactivated and non-staff users stay forbidden", async ({ page }) => {
    const fulfil = fx.staff.fulfillment as { email: string; id: string };
    await sb.from("admin_memberships").update({ is_active: false }).eq("user_id", fulfil.id);
    const outsiderEmail = `outsider-${Date.now()}@lh-test.local`;
    const { data: outsider } = await sb.auth.admin.createUser({ email: outsiderEmail, password: `Out-${randomUUID()}`, email_confirm: true });
    try {
      for (const [email, id] of [[fulfil.email, fulfil.id], [outsiderEmail, outsider.user!.id]] as const) {
        const { data } = await sb.auth.admin.generateLink({ type: "recovery", email });
        await page.context().clearCookies();
        await page.goto(`/admin/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery`);
        await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
        await page.getByLabel("Repeat new password").fill(NEW_PASSWORD);
        await page.getByRole("button", { name: "Save new password" }).click();
        await expect(page).toHaveURL(/\/admin\/login\?reset=1/, { timeout: 15_000 });
        await signIn(page, email, NEW_PASSWORD);
        await page.waitForURL(/\/admin\/forbidden/);
        const m = await sb.from("admin_memberships").select("role, is_active").eq("user_id", id).maybeSingle();
        expect(m.data?.is_active ?? false).toBe(false);
      }
    } finally {
      await sb.from("admin_memberships").update({ is_active: true }).eq("user_id", fulfil.id);
      await sb.auth.admin.deleteUser(outsider.user!.id);
    }
  });

  test("password API requires a fresh recovery session; a normal sign-in cannot use it", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin/reset-password");
    await expect(page.locator("p[role=alert]")).toContainText("needs a valid reset link");
    let r = await api(page, "/api/admin/account/password", { password: NEW_PASSWORD, confirm: NEW_PASSWORD });
    expect(r.status()).toBe(401);
    await signIn(page, manager.email, NEW_PASSWORD);
    await page.waitForURL(/\/admin$/);
    r = await api(page, "/api/admin/account/password", { password: `${NEW_PASSWORD}2`, confirm: `${NEW_PASSWORD}2` });
    expect(r.status()).toBe(401);
    expect((await r.json()).error).toBe("recovery_required");
  });

  test("request endpoint: generic answer, no mail for unknown addresses, rate limits, cross-site and bad links refused", async ({ page }) => {
    await page.goto("/admin/forgot-password");
    const unknown = `nobody-${Date.now()}@lh-test.local`;
    const r1 = await api(page, "/api/admin/account/recover", { email: unknown });
    const r2 = await api(page, "/api/admin/account/recover", { email: fx.staff.editor.email });
    expect(r1.status()).toBe(200);
    expect(await r1.json()).toEqual(await r2.json());
    await new Promise((res) => setTimeout(res, 2000));
    expect(await countMail(unknown)).toBe(0);

    expect((await api(page, "/api/admin/account/recover", { email: "not-an-email" })).status()).toBe(400);
    const xs = await page.request.post("/api/admin/account/recover", { headers: { origin: "https://evil.example" }, data: { email: unknown } });
    expect(xs.status()).toBe(403);

    // 3 per address per hour (one already used above for the editor), then 429.
    const same = `limit-${Date.now()}@lh-test.local`;
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await api(page, "/api/admin/account/recover", { email: same })).status());
    expect(statuses).toEqual([200, 200, 200, 429]);
    // 5 per IP per 15 minutes.
    // Fresh documentation-range IP per run: rate-limit buckets persist in the database for 15 minutes.
    const ip = `203.0.113.${(Date.now() % 250) + 1}`;
    const ipStatuses = [];
    for (let i = 0; i < 6; i++) ipStatuses.push((await api(page, "/api/admin/account/recover", { email: `ip-${i}-${Date.now()}@lh-test.local` }, ip)).status());
    expect(ipStatuses).toEqual([200, 200, 200, 200, 200, 429]);

    // Forged or foreign links land on the request page of this site, never elsewhere.
    await page.goto("/admin/auth/confirm?code=forged&next=https://evil.example/");
    await expect(page).toHaveURL(/127\.0\.0\.1:3001\/admin\/forgot-password\?link=invalid$/);
    await page.goto("/admin/auth/confirm?token_hash=forged&type=signup");
    await expect(page).toHaveURL(/\/admin\/forgot-password\?link=invalid$/);
  });
});
