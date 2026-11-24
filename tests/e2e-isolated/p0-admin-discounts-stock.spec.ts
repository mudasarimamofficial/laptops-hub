/**
 * Admin P0 fixes (ISOLATED stack only):
 *  1. Discounts: the owner can CREATE a discount from the admin UI (the form used to send `id: ""`, so every create
 *     failed with 400), and can re-save one whose dates came back from Postgres as "+00:00".
 *  2. Product edit: saving other fields never resets stock to the count loaded with the page (an order placed in
 *     between used to be silently undone); a stale stock edit is refused with the real count; a fresh stock edit goes
 *     through the inventory ledger.
 * QA rows are created on the local database and removed afterwards; the product is restored to its starting state.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const DISCOUNT = `QA discount ${RUN}`;
const PRODUCT = fx.products[fx.products.length - 1] as { handle: string; variantId: string };

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

test.describe.serial("Admin P0: discounts create/edit, stock not overwritten (isolated)", () => {
  test.setTimeout(180_000);
  let original: { mode: string; qty: number | null; seo: string | null } | null = null;

  test.beforeAll(async () => {
    await assertLocalOnly("admin p0 discounts/stock");
    const { data: v } = await sb.from("product_variants").select("inventory_mode, quantity_on_hand").eq("id", PRODUCT.variantId).single();
    const { data: p } = await sb.from("products").select("seo_title").eq("handle", PRODUCT.handle).single();
    original = { mode: v!.inventory_mode, qty: v!.quantity_on_hand, seo: p!.seo_title ?? null };
    // Start from a tracked variant with 5 units.
    const { error } = await sb.from("product_variants").update({ inventory_mode: "tracked", quantity_on_hand: 5 }).eq("id", PRODUCT.variantId);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await sb.from("discount_campaigns").delete().like("name", `QA discount ${RUN}%`);
    if (original) {
      await sb.from("product_variants").update({ inventory_mode: original.mode, quantity_on_hand: original.qty }).eq("id", PRODUCT.variantId);
      await sb.from("products").update({ seo_title: original.seo }).eq("handle", PRODUCT.handle);
    }
  });

  test("owner creates a draft discount, then saves it with dates twice (round-trip)", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/discounts");
    await page.getByRole("button", { name: "Create discount" }).click();
    await expect(page.getByRole("heading", { name: "New campaign" })).toBeVisible();
    await page.getByLabel("Name").fill(DISCOUNT);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit campaign" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(DISCOUNT) })).toBeVisible();

    const { data: created } = await sb.from("discount_campaigns").select("id, status, starts_at").eq("name", DISCOUNT).single();
    expect(created!.status).toBe("draft"); // never touches live prices

    // Dates, then a fresh page load (dates now come back from Postgres as "+00:00") and save again.
    await page.getByLabel("Starts at (UTC, optional)").fill("2030-01-01T10:00");
    await page.getByLabel(/Ends at/).fill("2030-01-08T10:00");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await sb.from("discount_campaigns").select("starts_at").eq("id", created!.id).single()).data?.starts_at).toBeTruthy();
    await page.reload();
    await page.getByRole("row", { name: new RegExp(DISCOUNT) }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(`${DISCOUNT} edited`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("row", { name: new RegExp(`${DISCOUNT} edited`) })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("API refuses anonymous discount writes", async ({ request }) => {
    const anon = await request.post("/api/admin/discounts", { data: { id: "", name: "x", kind: "percent", value: 5, status: "draft" } });
    expect([401, 403]).toContain(anon.status());
  });

  test("product save keeps an order's stock change; stale stock edit refused; fresh edit is ledgered", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/products/${encodeURIComponent(PRODUCT.handle)}`);
    const qty = page.getByLabel("Quantity on hand");
    await expect(qty).toHaveValue("5");

    // An order comes in while the page is open: 5 → 3.
    await sb.from("product_variants").update({ quantity_on_hand: 3 }).eq("id", PRODUCT.variantId);

    // Edit something else and save: stock must stay 3 (it used to be reset to 5).
    await page.getByLabel(/Page title/).fill(`QA SEO ${RUN}`);
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    const after1 = await sb.from("product_variants").select("quantity_on_hand").eq("id", PRODUCT.variantId).single();
    expect(after1.data!.quantity_on_hand).toBe(3);

    // A stock edit based on the old count is refused, with the real count shown.
    await qty.fill("7");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText(/Stock is now 3/)).toBeVisible();
    await expect(qty).toHaveValue("3");
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", PRODUCT.variantId).single()).data!.quantity_on_hand).toBe(3);

    // Now a deliberate edit from the real count goes through the inventory ledger.
    const { count: ledgerBefore } = await sb.from("inventory_ledger").select("*", { count: "exact", head: true }).eq("variant_id", PRODUCT.variantId);
    await qty.fill("7");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", PRODUCT.variantId).single()).data!.quantity_on_hand).toBe(7);
    const { count: ledgerAfter } = await sb.from("inventory_ledger").select("*", { count: "exact", head: true }).eq("variant_id", PRODUCT.variantId);
    expect((ledgerAfter ?? 0) - (ledgerBefore ?? 0)).toBe(1);
  });
});
