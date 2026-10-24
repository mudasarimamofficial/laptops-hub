/**
 * Admin shipping zones on the ISOLATED stack: create and edit through the real form, clear feedback, values stored in
 * paisa, and the checkout quote for a served and an unserved city. See docs/ISOLATED_TESTS.md.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function signIn(page: Page, role: "manager" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

test.describe.serial("admin shipping zones (isolated)", () => {
  const name = `Zone test ${Date.now()}`;
  test.beforeAll(async () => {
    await assertLocalOnly("shipping zone journeys");
  });

  test("before hydration the form cannot submit (no silent page reload, nothing lost)", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    // Sign in with JS first (login needs it), then load settings without JS to stand in for "not hydrated yet".
    const js = await browser.newContext();
    const p2 = await js.newPage();
    await signIn(p2, "manager");
    await ctx.addCookies(await js.cookies());
    await js.close();
    await page.goto("/admin/settings");
    const form = page.getByRole("form", { name: "Add shipping zone" });
    await expect(form.getByRole("button", { name: "Add zone" })).toBeDisabled();
    await ctx.close();
  });

  test("create: validation message, stored values in paisa, saved details shown, audit entry", async ({ page }) => {
    await signIn(page, "manager");
    await page.goto("/admin/settings");
    const form = page.getByRole("form", { name: "Add shipping zone" });
    await form.locator('input[name="name"]').fill(name);
    await form.getByLabel("Delivery fee (PKR)").fill("350");
    await form.getByLabel("COD fee (PKR)").fill("100");
    // Required fields are checked by the browser; with them filled, a missing province gets our message.
    await form.getByRole("button", { name: "Add zone" }).click();
    await expect(form.getByRole("alert")).toHaveText("Select at least one province.");
    await form.getByLabel("Sindh").check();
    await form.locator('input[name="cities"]').fill("Karachi, Hyderabad");
    await form.locator('input[name="notes"]').fill("Test courier, 3–5 working days");
    await form.locator('input[name="isActive"]').check();
    await form.getByRole("button", { name: "Add zone" }).click();
    await expect(form.getByRole("status")).toHaveText(
      `Saved: ${name} — Sindh · cities: Karachi, Hyderabad — delivery Rs 350, COD fee Rs 100 — active.`,
    );
    const { data: z } = await sb.from("shipping_zones").select("*").eq("name", name).single();
    expect(z).toMatchObject({ provinces: ["Sindh"], cities: ["Karachi", "Hyderabad"], flat_fee_paisa: 35_000, cod_fee_paisa: 10_000, is_active: true });
    const { count } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "shipping_zone.create").eq("entity_id", z!.id);
    expect(count).toBe(1);
    // After a reload the zone is listed.
    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("checkout quote: served city gets the zone fees, unserved city is refused", async ({ request }) => {
    const { data: z } = await sb.from("shipping_zones").select("id").eq("name", name).single();
    const quote = (city: string, province: string) =>
      request.post("/api/checkout/quote", {
        headers: { origin: "http://127.0.0.1:3001" },
        data: { address: { city, province }, lines: [{ variantId: fx.products[0].variantId, quantity: 1 }] },
      });
    const served = await (await quote("Karachi", "Sindh")).json();
    expect(served.ok, JSON.stringify(served).slice(0, 300)).toBe(true);
    const option = served.options.find((o: { id: string }) => o.id === z!.id);
    expect(option).toMatchObject({ flatFeePaisa: 35_000, codFeePaisa: 10_000 });
    expect(served.quote).toMatchObject({ shippingZoneId: z!.id, totalDuePaisa: fx.products[0].pricePaisa + 35_000 + 10_000 });
    const unserved = await (await quote("Sukkur", "Sindh")).json();
    expect(unserved.ok).toBe(false);
    expect(unserved.options.some((o: { id: string }) => o.id === z!.id)).toBe(false);
  });

  test("edit: deactivate shows the stored state; server rejects bad input with a clear message; editors are refused", async ({ page, browser }) => {
    await signIn(page, "manager");
    await page.goto("/admin/settings");
    const editForm = page.getByRole("form", { name: `Edit ${name}` });
    await page.getByText("Edit zone").last().click();
    await editForm.locator('input[name="isActive"]').uncheck();
    await editForm.getByRole("button", { name: "Save changes" }).click();
    await expect(editForm.getByRole("status")).toContainText("— not active.");
    expect((await sb.from("shipping_zones").select("is_active").eq("name", name).single()).data?.is_active).toBe(false);

    const origin = new URL(page.url()).origin;
    const bad = await page.request.post("/api/admin/shipping-zones", { headers: { origin }, data: { name: "X", provinces: ["Sindh"], flatFeePkr: 1, codFeePkr: 1 } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).message).toContain("at least 2 characters");

    const ctx = await browser.newContext();
    const ed = await ctx.newPage();
    await signIn(ed, "editor");
    const denied = await ed.request.post("/api/admin/shipping-zones", { headers: { origin }, data: { name: "Editor zone", provinces: ["Sindh"], flatFeePkr: 1, codFeePkr: 1 } });
    expect(denied.status()).toBe(403);
    await ctx.close();
  });
});
