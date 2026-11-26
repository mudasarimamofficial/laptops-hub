/**
 * G22 COD cash safety on the ISOLATED stack (needs 20261126140000_cod_collection_adjustments applied locally).
 *  - collection uses its own note; history shows staff, time and reason
 *  - reversal and correction by owner/manager; fulfillment cannot correct (UI and API); reasons required
 *  - idempotent replay; bounds refused; order totals never change
 *  - cancelled/returned orders refuse new cash (UI and API)
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36).toUpperCase().slice(-6);
const OPEN = `LH-SANDBOX-G22-${RUN}`;
const CLOSED = `LH-SANDBOX-G22C-${RUN}`;
const TOTALS = { subtotal_paisa: 95000, shipping_paisa: 3600, cod_fee_paisa: 500, discount_paisa: 0, total_due_paisa: 99100 };

async function signIn(page: Page, who: "owner" | "manager" | "fulfillment") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[who].email);
  await page.getByLabel("Password").fill(fx.staff[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const order = async (n: string) =>
  (await sb.from("orders").select("id, status, payment_status, amount_collected_paisa, subtotal_paisa, shipping_paisa, cod_fee_paisa, discount_paisa, total_due_paisa").eq("order_number", n).single()).data!;
const adjustments = async (id: string) => (await sb.from("cod_collection_adjustments").select("*").eq("order_id", id).order("created_at")).data || [];

test.describe.serial("G22: COD cash history, reversals and corrections (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("cod ledger");
    await sb.from("orders").delete().like("order_number", "LH-SANDBOX-G22%");
    for (const [n, status] of [[OPEN, "delivered"], [CLOSED, "cancelled"]] as const) {
      const { error } = await sb.from("orders").insert({
        order_number: n, status, customer_name: `SANDBOX G22 ${RUN}`, customer_phone_e164: "+923001112233",
        customer_phone_normalized: "03001112233", idempotency_key: `sandbox-${n}`, ...TOTALS,
      });
      expect(error).toBeNull();
    }
  });
  test.afterAll(async () => {
    await sb.from("orders").delete().like("order_number", "LH-SANDBOX-G22%");
  });

  test("owner: collect with its own note, reverse one collection, correct with a reason; totals unchanged", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "owner");
    await page.goto(`/admin/orders/${OPEN}`);
    const amount = page.getByLabel("Amount collected (PKR)");
    await amount.fill("600");
    await page.getByLabel("Collection note").fill(`QA ${RUN} first cash`);
    await page.getByRole("button", { name: "Record collection" }).click();
    await expect(page.getByText(/COD recorded/)).toBeVisible();
    await expect.poll(async () => (await order(OPEN)).amount_collected_paisa).toBe(60000);
    await expect(amount).toHaveValue("391");
    await page.getByRole("button", { name: "Record collection" }).click();
    await expect.poll(async () => (await order(OPEN)).payment_status).toBe("collected");

    const ledger = page.getByTestId("cod-ledger");
    await expect(ledger.getByTestId("cod-ledger-entry")).toHaveCount(2);
    await expect(ledger).toContainText(`QA ${RUN} first cash`);
    await expect(ledger).toContainText("recorded by Owner");

    // Reverse the PKR 391 collection: a short reason keeps the button disabled.
    await ledger.getByRole("button", { name: /Reverse the .*391 collection/ }).click();
    const why = page.getByLabel("Why is this collection being reversed?");
    await why.fill("no");
    const confirm = ledger.getByRole("button", { name: /^Reverse .*391/ });
    await expect(confirm).toBeDisabled();
    await why.fill(`QA ${RUN}: courier returned this cash`);
    await confirm.click();
    await expect(page.getByTestId("cod-ledger-msg")).toContainText("partly collected");
    let o = await order(OPEN);
    expect(o.amount_collected_paisa).toBe(60000);
    expect(o.payment_status).toBe("partially_collected");

    // Correction: remove PKR 100 with a reason.
    const form = page.getByTestId("cod-correction");
    await form.getByLabel("Correction").selectOption("remove");
    await form.getByLabel("Amount (PKR)").fill("100");
    await form.getByLabel("Reason (kept permanently)").fill(`QA ${RUN}: rider kept change`);
    await form.getByRole("button", { name: "Record correction" }).click();
    await expect(page.getByTestId("cod-ledger-msg")).toContainText("partly collected");
    o = await order(OPEN);
    expect(o.amount_collected_paisa).toBe(50000);

    await page.reload();
    await expect(ledger.getByTestId("cod-ledger-entry")).toHaveCount(4);
    await expect(ledger.locator('[data-kind="reversal"]')).toContainText("courier returned this cash");
    await expect(ledger.locator('[data-kind="correction"]')).toContainText("rider kept change");
    await expect(ledger.locator('[data-kind="collection"]').filter({ hasText: "Reversed" })).toHaveCount(1);
    await expect(ledger.getByRole("button", { name: /Reverse the .*391 collection/ })).toHaveCount(0);

    const adj = await adjustments(o.id);
    expect(adj.map((a) => [a.kind, a.delta_paisa])).toEqual([["reversal", -39100], ["correction", -10000]]);
    expect(adj.map((a) => a.recorded_by)).toEqual([fx.staff.owner.id, fx.staff.owner.id]);
    expect(adj.every((a) => a.reason.startsWith(`QA ${RUN}`) && a.created_at)).toBe(true);
    const { subtotal_paisa, shipping_paisa, cod_fee_paisa, discount_paisa, total_due_paisa } = o;
    expect({ subtotal_paisa, shipping_paisa, cod_fee_paisa, discount_paisa, total_due_paisa }).toEqual(TOTALS);
  });

  test("API: replay is idempotent, bounds and reasons are enforced, manager may correct", async ({ page }) => {
    await signIn(page, "manager");
    const api = "/api/admin/cod-collections/adjust";
    const body = { kind: "correction", orderNumber: OPEN, deltaPkr: -50, reason: `QA ${RUN}: miscount`, idempotencyKey: `qa-${RUN}-replay` };
    const first = await page.request.post(api, { data: body });
    expect(first.status()).toBe(200);
    const again = await page.request.post(api, { data: body });
    expect((await again.json()).idempotentReplay).toBe(true);
    const o = await order(OPEN);
    expect(o.amount_collected_paisa).toBe(45000);
    expect((await adjustments(o.id)).filter((a) => a.idempotency_key === `qa-${RUN}-replay`)).toHaveLength(1);

    const conflict = await page.request.post(api, { data: { ...body, deltaPkr: -60 } });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error).toBe("idempotency_conflict");
    const below = await page.request.post(api, { data: { ...body, deltaPkr: -5000, idempotencyKey: `qa-${RUN}-below` } });
    expect((await below.json()).error).toBe("below_zero");
    const over = await page.request.post(api, { data: { ...body, deltaPkr: 900, idempotencyKey: `qa-${RUN}-over` } });
    expect((await over.json()).error).toBe("over_collection");
    const noReason = await page.request.post(api, { data: { ...body, reason: "x", idempotencyKey: `qa-${RUN}-short` } });
    expect(noReason.status()).toBe(400);
    expect((await order(OPEN)).amount_collected_paisa).toBe(45000);
  });

  test("fulfillment: can see history, cannot correct; cancelled order refuses new cash", async ({ page }) => {
    await signIn(page, "fulfillment");
    await page.goto(`/admin/orders/${OPEN}`);
    await expect(page.getByTestId("cod-ledger-entry").first()).toBeVisible();
    await expect(page.getByTestId("cod-correction")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Reverse the/ })).toHaveCount(0);
    const denied = await page.request.post("/api/admin/cod-collections/adjust", {
      data: { kind: "correction", orderNumber: OPEN, deltaPkr: -10, reason: "Should be refused", idempotencyKey: `qa-${RUN}-ful` },
    });
    expect(denied.status()).toBe(403);

    await page.goto(`/admin/orders/${CLOSED}`);
    await expect(page.getByTestId("cod-closed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Record collection" })).toHaveCount(0);
    const refused = await page.request.post("/api/admin/cod-collections", {
      data: { orderNumber: CLOSED, amountPkr: 100, idempotencyKey: `qa-${RUN}-closed` },
    });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error).toBe("order_closed");
    expect((await order(CLOSED)).amount_collected_paisa).toBe(0);
  });
});
