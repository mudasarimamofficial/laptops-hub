/**
 * G24 Settings › Notifications on the ISOLATED stack with the LOCAL fake email provider (scripts/test-fixtures/fake-resend.mjs).
 *  - owner edits staff recipients, inquiry alerts, customer mode and wording; saved values persist
 *  - "Send test email to staff" goes to the saved staff emails only (the request cannot name an address)
 *  - a website inquiry queues a staff-only alert; the person who wrote in is never emailed; it shows in Recent notifications
 *  - permissions: manager/editor/fulfillment refused (UI hidden + API 403); admin cannot turn customer emails on; owner can
 * No real email is sent: RESEND_API_URL must point at 127.0.0.1.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const FAKE = process.env.RESEND_API_URL || "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(FAKE)) throw new Error("RESEND_API_URL must be the local fake provider");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const STAFF = [`g24-a-${RUN}@lh-test.local`, `g24-b-${RUN}@lh-test.local`];
const INQUIRER = `g24-inquirer-${RUN}@lh-test.local`;

type Delivered = { key: string | null; to: string[]; subject: string; text: string };
const fakeLog = async () => ((await (await fetch(`${FAKE}/_log`)).json()) as { delivered: Delivered[] }).delivered;
const stored = async () => (await sb.from("store_settings").select("value").eq("key", "notifications").maybeSingle()).data?.value as Record<string, unknown> | undefined;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const api = (page: Page, path: string, method: string, body?: unknown) =>
  page.evaluate(
    async ([p, m, b]) => {
      const r = await fetch(p as string, { method: m as string, headers: { "content-type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    },
    [path, method, body] as const,
  );
const valid = { recipients: STAFF, customerMode: "off", inquiryAlerts: true, orderSubject: "", customerSubject: "", customerIntro: "" };

let prev: unknown = null;
let adminUser: { id: string; email: string; password: string } | null = null;

test.describe.serial("G24: notification settings (isolated, fake provider)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("notifications g24");
    prev = (await stored()) ?? null;
    await sb.from("store_settings").delete().eq("key", "notifications");
    await fetch(`${FAKE}/_reset`, { method: "POST" });
    const email = `g24-admin-${RUN}@lh-test.local`;
    const password = `T3st-${randomUUID()}`;
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    expect(error).toBeNull();
    await sb.from("admin_memberships").upsert({ user_id: data.user!.id, role: "admin", is_active: true });
    adminUser = { id: data.user!.id, email, password };
  });
  test.afterAll(async () => {
    if (prev) await sb.from("store_settings").upsert({ key: "notifications", value: prev });
    else await sb.from("store_settings").delete().eq("key", "notifications");
    await sb.from("contact_inquiries").delete().like("name", `G24 Visitor ${RUN}%`);
    if (adminUser) {
      await sb.from("admin_memberships").delete().eq("user_id", adminUser.id);
      await sb.auth.admin.deleteUser(adminUser.id);
    }
  });

  test("owner: edits notification settings, sends a staff-only test, and sees inquiry alerts", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, fx.staff.owner.email, fx.staff.owner.password);
    await page.goto("/admin/settings#notifications");
    const box = page.getByTestId("notification-settings");
    await expect(page.getByTestId("notification-provider")).toContainText("connected");
    await expect(page.getByTestId("notification-provider")).toContainText("cannot be changed here");

    await box.getByLabel("Staff emails for order and inquiry alerts").fill(STAFF.join("\n"));
    await box.getByLabel(/Email staff about new website inquiries/).check();
    await box.getByLabel(/^Test mode/).check();
    await box.getByLabel("Customer email subject").fill("Order {order} received — thank you");
    await box.getByRole("button", { name: "Save notification settings" }).click();
    await expect(box.getByTestId("notification-msg")).toContainText("saved");
    await expect.poll(stored).toMatchObject({ recipients: STAFF, customer_mode: "test", inquiry_alerts: true, customer_subject: "Order {order} received — thank you" });

    // Reload: the form shows the saved values.
    await page.reload();
    await expect(box.getByLabel("Staff emails for order and inquiry alerts")).toHaveValue(STAFF.join("\n"));
    await expect(box.getByLabel(/^Test mode/)).toBeChecked();

    // Test send: saved staff emails only.
    await box.getByRole("button", { name: "Send test email to staff" }).click();
    await expect(box.getByTestId("notification-msg")).toContainText("Accepted by the email provider");
    const tests = (await fakeLog()).filter((d) => d.key?.startsWith("notify-test-"));
    expect(tests).toHaveLength(1);
    expect([...tests[0].to].sort()).toEqual([...STAFF].sort());
    expect(tests[0].text).toContain("No customer was emailed");

    // A website inquiry → staff-only alert.
    const origin = new URL(page.url()).origin;
    const r = await page.request.post("/api/contact", {
      headers: { origin, "x-forwarded-for": `198.51.100.${(Date.now() % 200) + 20}` },
      data: { name: `G24 Visitor ${RUN}`, email: INQUIRER, subject: "Battery question", message: "Is the battery replaceable on this model?" },
    });
    expect(r.status()).toBe(200);
    await expect
      .poll(async () => (await fakeLog()).filter((d) => d.subject === "New website inquiry — Battery question").length, { timeout: 20_000 })
      .toBe(1);
    const alert = (await fakeLog()).find((d) => d.subject === "New website inquiry — Battery question")!;
    expect([...alert.to].sort()).toEqual([...STAFF].sort());
    expect((await fakeLog()).some((d) => d.to.includes(INQUIRER))).toBe(false);
    await page.reload();
    await expect(page.getByTestId("notification-delivery").filter({ hasText: "Inquiry alert" }).first()).toContainText("accepted");

    // Validation.
    const bad = await api(page, "/api/admin/notifications/settings", "PUT", { ...valid, recipients: ["not-an-email"] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/not valid/);

    // Owner may turn customer emails on.
    const on = await api(page, "/api/admin/notifications/settings", "PUT", { ...valid, customerMode: "on" });
    expect(on.status).toBe(200);
    expect((await stored())?.customer_mode).toBe("on");
  });

  test("admin: can edit and test, but cannot start emailing customers", async ({ page }) => {
    await sb.from("store_settings").upsert({ key: "notifications", value: { recipients: STAFF, customer_mode: "test", inquiry_alerts: false } });
    await signIn(page, adminUser!.email, adminUser!.password);
    await page.goto("/admin/settings#notifications");
    await expect(page.getByTestId("notification-settings")).toBeVisible();
    const refused = await api(page, "/api/admin/notifications/settings", "PUT", { ...valid, customerMode: "on" });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe("owner_required");
    expect((await stored())?.customer_mode).toBe("test");
    const ok = await api(page, "/api/admin/notifications/settings", "PUT", { ...valid, customerMode: "off" });
    expect(ok.status).toBe(200);
  });

  test("owner at 390px: notifications section fits the screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, fx.staff.owner.email, fx.staff.owner.password);
    await page.goto("/admin/settings#notifications");
    const box = page.getByTestId("notification-settings");
    await box.scrollIntoViewIfNeeded();
    await expect(box.getByRole("button", { name: "Save notification settings" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const b = await box.boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(390);
    if (process.env.G24_SHOT_DIR) await box.screenshot({ path: `${process.env.G24_SHOT_DIR}/g24-notifications-390.png` });
  });

  for (const role of ["manager", "editor", "fulfillment"] as const) {
    test(`${role}: no notification settings (hidden in UI, API refused)`, async ({ page }) => {
      await signIn(page, fx.staff[role].email, fx.staff[role].password);
      if (role === "manager") {
        await page.goto("/admin/settings");
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        await expect(page.getByTestId("notification-settings")).toHaveCount(0);
      }
      const before = await fakeLog();
      expect((await api(page, "/api/admin/notifications/settings", "GET")).status).toBe(403);
      expect((await api(page, "/api/admin/notifications/settings", "PUT", valid)).status).toBe(403);
      expect((await api(page, "/api/admin/notifications/test", "POST")).status).toBe(403);
      expect((await fakeLog()).length).toBe(before.length);
    });
  }
});
