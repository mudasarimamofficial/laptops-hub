/**
 * Launch acceptance journeys against an ISOLATED stack only: local Supabase seeded by
 * scripts/test-fixtures/seed-isolated.mjs, the app built with COD enabled and RESEND_API_URL pointing at
 * scripts/test-fixtures/fake-resend.mjs. See docs/ISOLATED_TESTS.md ("Launch journeys").
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { formatPkr } from "../../src/lib/money";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated journeys need a local Supabase");
const FAKE = process.env.FAKE_RESEND_URL || "http://127.0.0.1:4599";
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const P = fx.products[0];
const TOTAL = P.pricePaisa + fx.zone.flatFeePaisa + fx.zone.codFeePaisa;
const rs = (paisa: number) => formatPkr(paisa);
const PHONE = "03001234567";

const fakeLog = async () => (await (await fetch(`${FAKE}/_log`)).json()) as { delivered: { to: string[]; subject: string; key: string }[]; attempts: number };
const fakeMode = (fail: boolean) => fetch(`${FAKE}/_mode`, { method: "POST", body: JSON.stringify({ fail }) });
const waitFor = async <T,>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 20_000) => {
  const end = Date.now() + ms;
  let v = await fn();
  while (!ok(v) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 400));
    v = await fn();
  }
  return v;
};
const outboxFor = async (orderNumber: string) => {
  const { data: o } = await sb.from("orders").select("id").eq("order_number", orderNumber).single();
  return (await sb.from("notification_outbox").select("status, attempts, last_error").eq("order_id", o!.id)).data || [];
};
const apiOrder = (page: Page, key: string, email?: string) =>
  page.request.post("/api/checkout/cod", {
    headers: { origin: new URL(page.url() || "http://127.0.0.1:3001").origin },
    data: {
      idempotencyKey: key, customerName: "Api Test", customerPhone: PHONE, ...(email ? { customerEmail: email } : {}),
      shippingZoneId: fx.zone.id, confirmCod: true,
      address: { line1: "House 9, Test Road", city: fx.zone.city, province: fx.zone.province },
      lines: [{ variantId: P.variantId, quantity: 1 }],
    },
  });
async function signIn(page: Page, role: "manager" | "fulfillment" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

let orderNumber = "";
let orderUrl = "";

test.describe.serial("launch journeys (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("launch journeys");
    await fetch(`${FAKE}/_reset`, { method: "POST" });
  });

  test("customer: product → cart → checkout → confirmation", async ({ page }) => {
    await page.goto(`/products/${P.handle}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Latitude 7420");
    await page.getByRole("button", { name: /Add to cart/ }).first().click();
    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Ayesha Test");
    await page.getByLabel(/Mobile/).fill(PHONE);
    await page.getByLabel(/Email/).fill("buyer@lh-test.local");
    await page.getByLabel("Street address").fill("House 1, Street 2, Model Town");
    await page.getByLabel("City").fill("Lahore");
    await page.getByLabel("Province").selectOption("Punjab");
    await page.getByLabel(/Lahore standard \(test\)/).check();
    await expect(page.getByText(`Cash due: ${rs(TOTAL)}`)).toBeVisible();
    await page.getByRole("checkbox", { name: /I will pay the cash-due amount/ }).check();
    await page.getByRole("button", { name: "Place COD order" }).click();
    await page.waitForURL(/\/order\/success\//);
    orderUrl = new URL(page.url()).pathname;
    await expect(page.getByTestId("order-status")).toHaveText("Received — awaiting confirmation");
    await expect(page.getByTestId("order-total")).toHaveText(rs(TOTAL));
    orderNumber = (await page.locator("p", { hasText: /^LH-\d{6}-[0-9A-F]{6}$/ }).first().textContent())!.trim();
    expect(orderNumber).toMatch(/^LH-\d{6}-[0-9A-F]{6}$/);
    const { data: o } = await sb.from("orders").select("id, total_due_paisa, status, payment_status, confirmation_version").eq("order_number", orderNumber).single();
    expect(o).toMatchObject({ total_due_paisa: TOTAL, status: "placed", payment_status: "unpaid_cod", confirmation_version: "cod-v2-terms-returns-privacy" });
    const { count } = await sb.from("order_items").select("id", { count: "exact", head: true }).eq("order_id", o!.id);
    expect(count).toBe(1);
  });

  test("notifications: business alert + customer confirmation delivered once", async () => {
    const log = await waitFor(fakeLog, (l) => l.delivered.filter((d) => d.subject.includes(orderNumber)).length >= 2);
    const mine = log.delivered.filter((d) => d.subject.includes(orderNumber));
    expect(mine.map((d) => d.to[0]).sort()).toEqual(["buyer@lh-test.local", "owner@lh-test.local"]);
    expect(mine.find((d) => d.to[0] === "owner@lh-test.local")!.subject).toContain("New COD order");
    const rows = await waitFor(() => outboxFor(orderNumber), (r) => r[0]?.status === "accepted");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("accepted");
  });

  test("customer: track order by number + phone; wrong phone refused", async ({ page }) => {
    await page.goto("/track-order");
    await page.getByLabel("Order number").fill(orderNumber);
    await page.getByLabel(/Mobile number/).fill("03009999999");
    await page.getByRole("button", { name: "Find my order" }).click();
    await expect(page.locator("#track-error")).toContainText("No order matches");
    await page.getByLabel(/Mobile number/).fill(PHONE);
    await page.getByRole("button", { name: "Find my order" }).click();
    await page.waitForURL((u) => u.pathname === orderUrl);
    await expect(page.getByTestId("order-status")).toHaveText("Received — awaiting confirmation");
  });

  test("checkout: unserved address and invalid phone are refused", async ({ page }) => {
    await page.goto(`/products/${P.handle}`);
    await page.getByRole("button", { name: /Add to cart/ }).first().click();
    await page.goto("/checkout");
    await page.getByLabel("City").fill("Quetta");
    await page.getByLabel("Province").selectOption("Balochistan");
    await expect(page.getByText("We do not currently deliver COD to this city/province.")).toBeVisible();
    const r = await page.request.post("/api/checkout/cod", {
      headers: { origin: "http://127.0.0.1:3001" },
      data: { idempotencyKey: `iso-${randomUUID()}`, customerName: "Bad Phone", customerPhone: "12345", shippingZoneId: fx.zone.id, confirmCod: true, address: { line1: "x street", city: "Lahore", province: "Punjab" }, lines: [{ variantId: P.variantId, quantity: 1 }] },
    });
    expect(r.status()).toBe(400);
    const over = await page.request.post("/api/checkout/cod", {
      headers: { origin: "http://127.0.0.1:3001" },
      data: { idempotencyKey: `iso-${randomUUID()}`, customerName: "Too Many", customerPhone: PHONE, shippingZoneId: fx.zone.id, confirmCod: true, address: { line1: "x street", city: "Lahore", province: "Punjab" }, lines: [{ variantId: P.variantId, quantity: P.max + 1 }] },
    });
    expect([400, 409]).toContain(over.status());
  });

  test("duplicate submit: one order, one notification", async ({ page }) => {
    await page.goto("/");
    const key = `iso-dup-${randomUUID()}`;
    const [a, b] = await Promise.all([apiOrder(page, key), apiOrder(page, key)]);
    const ja = await a.json();
    const jb = await b.json();
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    expect(ja.orderNumber).toBe(jb.orderNumber);
    const rows = await waitFor(() => outboxFor(ja.orderNumber), (r) => r[0]?.status === "accepted");
    expect(rows).toHaveLength(1);
    const log = await fakeLog();
    expect(log.delivered.filter((d) => d.subject.includes(ja.orderNumber))).toHaveLength(1);
  });

  test("admin: editor cannot open orders", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/forbidden/);
  });

  test("admin: confirm → pack → dispatch with tracking → collect COD; customer sees it", async ({ page }) => {
    await signIn(page, "manager");
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: orderNumber }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(orderNumber);
    for (const to of ["confirmed", "packing", "shipped"]) {
      await page.getByLabel("Next status").selectOption(to);
      if (to === "shipped") {
        await page.getByLabel("Carrier (optional)").fill("Test Courier");
        await page.getByLabel("Tracking (optional)").fill("TEST-123");
      }
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByText(`Status → ${to}`)).toBeVisible();
      await expect(page.getByText(`Current: ${to}`)).toBeVisible();
    }
    await page.getByLabel("Collector reference").fill("rider-1");
    await page.getByRole("button", { name: "Record collection" }).click();
    await expect(page.getByText("Fully collected.")).toBeVisible();
    const { data: o } = await sb.from("orders").select("id, status, payment_status, amount_collected_paisa").eq("order_number", orderNumber).single();
    expect(o).toMatchObject({ status: "shipped", payment_status: "collected", amount_collected_paisa: TOTAL });
    const { count: events } = await sb.from("order_events").select("id", { count: "exact", head: true }).eq("order_id", o!.id);
    expect(events).toBeGreaterThanOrEqual(5); // placed + 3 transitions + collection
    const { count: audits } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("entity_id", o!.id);
    expect(audits).toBeGreaterThanOrEqual(4);

    await page.goto(orderUrl);
    await expect(page.getByTestId("order-status")).toHaveText("Dispatched");
    await expect(page.getByText("Test Courier · TEST-123")).toBeVisible();
    await expect(page.getByText("Paid — cash collected")).toBeVisible();
  });

  test("admin: cancellation by fulfillment staff", async ({ page }) => {
    await page.goto("/");
    const res = await apiOrder(page, `iso-cancel-${randomUUID()}`);
    const { orderNumber: n, accessToken } = await res.json();
    await signIn(page, "fulfillment");
    await page.goto(`/admin/orders/${n}`);
    await page.getByLabel("Next status").selectOption("cancelled");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText("Current: cancelled")).toBeVisible();
    await page.goto(`/order/success/${accessToken}`);
    await expect(page.getByTestId("order-status")).toHaveText("Cancelled");
  });

  test("fulfillment: failed delivery → re-attempt → delivered → returned; shipped cannot be cancelled", async ({ page }) => {
    await page.goto("/");
    const res = await apiOrder(page, `iso-fulfil-${randomUUID()}`);
    const { orderNumber: n, accessToken } = await res.json();
    await signIn(page, "manager");
    await page.goto(`/admin/orders/${n}`);
    const step = async (to: string, extra?: () => Promise<void>) => {
      await page.getByLabel("Next status").selectOption(to);
      await extra?.();
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByText(`Current: ${to}`)).toBeVisible();
    };
    await step("confirmed");
    await step("packing");
    await step("shipped", async () => {
      await page.getByLabel("Carrier (optional)").fill("Test Courier");
      await page.getByLabel("Tracking (optional)").fill("TEST-FAIL-1");
    });
    // Once shipped, cancellation is no longer offered, and the server refuses it.
    await expect(page.getByLabel("Next status").locator("option", { hasText: /^cancelled$/ })).toHaveCount(0);
    const origin = new URL(page.url()).origin;
    const refused = await page.request.post(`/api/admin/orders/${n}/status`, { headers: { origin }, data: { toStatus: "cancelled" } });
    expect(refused.ok()).toBeFalsy();
    await step("delivery_failed");
    await step("shipped"); // re-attempt
    await step("out_for_delivery");
    await step("delivered");
    await step("returned");
    const { data: o } = await sb.from("orders").select("id, status, payment_status, amount_collected_paisa").eq("order_number", n).single();
    expect(o).toMatchObject({ status: "returned", amount_collected_paisa: 0 });
    const { data: ev } = await sb.from("order_events").select("to_status").eq("order_id", o!.id).order("created_at");
    expect((ev || []).map((e) => e.to_status).filter(Boolean)).toEqual([
      "placed", "confirmed", "packing", "shipped", "delivery_failed", "shipped", "out_for_delivery", "delivered", "returned",
    ]);
    await page.goto(`/order/success/${accessToken}`);
    await expect(page.getByText("Test Courier · TEST-FAIL-1")).toBeVisible();
  });

  test("fulfillment: failed delivery → returned to store", async ({ page }) => {
    await page.goto("/");
    const res = await apiOrder(page, `iso-return-${randomUUID()}`);
    const { orderNumber: n } = await res.json();
    await signIn(page, "fulfillment");
    await page.goto(`/admin/orders/${n}`);
    for (const to of ["confirmed", "packing", "shipped", "delivery_failed", "returned"]) {
      await page.getByLabel("Next status").selectOption(to);
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByText(`Current: ${to}`)).toBeVisible();
    }
    await expect(page.getByText("No further transitions from this status.")).toBeVisible();
  });

  test("notifications: provider outage → failed, staff retry → sent once", async ({ page }) => {
    await fakeMode(true);
    await page.goto("/");
    const res = await apiOrder(page, `iso-fail-${randomUUID()}`);
    const { orderNumber: n } = await res.json();
    const failed = await waitFor(() => outboxFor(n), (r) => r[0]?.status === "failed");
    expect(failed[0].status).toBe("failed");
    expect(failed[0].attempts).toBe(1);
    expect(failed[0].last_error).toContain("500");
    await fakeMode(false);
    await signIn(page, "manager");
    await page.goto(`/admin/orders/${n}`);
    await expect(page.getByTestId("notification-status")).toHaveText("failed");
    await page.getByRole("button", { name: "Retry sending" }).click();
    await expect(page.getByText(/Accepted 1 · failed 0/)).toBeVisible();
    const rows = await outboxFor(n);
    expect(rows[0]).toMatchObject({ status: "accepted", attempts: 2 });
    const log = await fakeLog();
    expect(log.delivered.filter((d) => d.subject.includes(n))).toHaveLength(1);
  });

  test("cron endpoint requires the secret", async ({ request }) => {
    expect((await request.get("/api/cron/notifications")).status()).toBe(401);
    const ok = await request.get("/api/cron/notifications", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).configured).toBe(true);
  });
});
