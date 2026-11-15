/**
 * P0 inventory control on the ISOLATED stack (migration 20261117100000 + variants route):
 *  - "Continue selling when out of stock" is an owner/admin decision: a manager sees it disabled and a forged API
 *    request to change it is refused (403) with nothing stored.
 *  - The owner sets it in the variant matrix; it persists after reload and survives a save that omits the field.
 *  - A real storefront API order on that variant at 0 stock then succeeds and leaves -1 with a ledger row.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const TAG = Date.now().toString(36);
const HANDLE = `qa-oversell-${TAG}`;
let productId = "";
let variantId = "";

async function signIn(page: Page, role: "owner" | "manager") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

const stored = async () =>
  (await sb.from("product_variants").select("allow_oversell, quantity_on_hand").eq("id", variantId).single()).data!;

const row = (o: Record<string, unknown> = {}) => ({
  id: variantId,
  title: "Default",
  sku: `QA-OS-${TAG}`,
  pricePkr: 50_000,
  inventoryMode: "tracked",
  quantityOnHand: 0,
  purchasable: true,
  optionValues: {},
  ...o,
});

test.describe.serial("P0: oversell is owner/admin-only and honoured at checkout (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("p0 inventory oversell");
    const p = await sb.from("products").insert({ handle: HANDLE, title: `QA Oversell ${TAG}`, status: "active", category: "Laptop" }).select("id").single();
    expect(p.error).toBeNull();
    productId = p.data!.id;
    const v = await sb.from("product_variants").insert({ product_id: productId, title: "Default", sku: `QA-OS-${TAG}`, price_paisa: 5_000_000, inventory_mode: "tracked", quantity_on_hand: 0 }).select("id").single();
    expect(v.error).toBeNull();
    variantId = v.data!.id;
  });

  test.afterAll(async () => {
    await sb.from("products").update({ status: "archived" }).eq("id", productId);
  });

  test("manager: control is read-only and a forged API change is refused", async ({ page }) => {
    await signIn(page, "manager");
    await page.goto(`/admin/products/${HANDLE}`);
    await expect(page.getByTestId("variant-oversell")).toBeDisabled();
    const res = await page.request.put(`/api/admin/products/${HANDLE}/variants`, {
      data: { optionNames: [], variants: [row({ allowOversell: true })] },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(res.status()).toBe(403);
    expect((await stored()).allow_oversell).toBe(false);
  });

  test("owner: sets it in the matrix, it persists, and a save without the field keeps it", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto(`/admin/products/${HANDLE}`);
    const box = page.getByTestId("variant-oversell");
    await expect(box).toBeEnabled();
    await box.check();
    const save = page.waitForResponse((r) => r.url().includes(`/api/admin/products/${HANDLE}/variants`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: /save variants/i }).click();
    expect((await save).status()).toBe(200);
    expect((await stored()).allow_oversell).toBe(true);
    await page.reload();
    await expect(page.getByTestId("variant-oversell")).toBeChecked();

    // A client that does not know the field (older tab / CSV-style payload) must not wipe the owner's decision.
    const res = await page.request.put(`/api/admin/products/${HANDLE}/variants`, {
      data: { optionNames: [], variants: [row({ pricePkr: 51_000 })] },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(res.status()).toBe(200);
    expect((await stored()).allow_oversell).toBe(true);
  });

  test("checkout honours it: order at 0 stock succeeds, stock -1, ledger written", async () => {
    const zone = (await sb.from("shipping_zones").select("id").eq("id", fx.zone.id).single()).data!;
    const prev = (await sb.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle()).data?.value ?? null;
    await sb.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: true } });
    try {
      const r = await sb.rpc("create_cod_order", {
        payload: {
          idempotency_key: `qa-os-${randomUUID()}`,
          customer_name: "Oversell Test",
          customer_phone_e164: "+923001234567",
          customer_phone_normalized: "923001234567",
          shipping_zone_id: zone.id,
          address: { line1: "Test street 1", city: fx.zone.city || "Lahore", province: fx.zone.province || "Punjab" },
          lines: [{ variant_id: variantId, quantity: 1 }],
        },
      });
      expect(r.error, r.error?.message).toBeNull();
      expect((await stored()).quantity_on_hand).toBe(-1);
      const l = await sb.from("inventory_ledger").select("delta, quantity_after, reason").eq("variant_id", variantId);
      expect(l.data).toEqual([{ delta: -1, quantity_after: -1, reason: "order_placed" }]);
    } finally {
      if (prev) await sb.from("store_settings").upsert({ key: "cod_checkout", value: prev });
    }
  });
});
