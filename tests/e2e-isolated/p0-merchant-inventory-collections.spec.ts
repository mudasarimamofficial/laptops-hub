/**
 * Merchant OS on the ISOLATED stack:
 *  - Collections from the admin UI: manual (product search → add) and automated (brand rule); the storefront
 *    collection shows exactly the right products.
 *  - Inventory desk: add received units, set a counted quantity, refuse below-zero, history row written; editor refused.
 *  - Analytics: honest counts that match the database; definitions shown.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("merchant journeys need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const TAG = Date.now().toString(36);
const DELL = fx.products[0].handle as string;
const LENOVO = fx.products[1].handle as string;
const created: { collections: string[]; product?: string; ghostProduct?: string } = { collections: [] };

async function signIn(page: Page, role: "owner" | "manager" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function createCollection(page: Page, title: string, automatedBrand?: string) {
  await page.goto("/admin/collections/new");
  await page.getByLabel("Title").fill(title);
  if (automatedBrand) {
    await page.getByLabel(/^Automated/).check();
    await page.getByLabel("Manufacturer equals").fill(automatedBrand);
  }
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Create collection" }).click();
  await page.waitForURL(/\/admin\/collections\/(?!new)[a-z0-9-]+$/);
  const slug = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
  created.collections.push(slug);
  return slug;
}

const storefrontHandles = async (page: Page, slug: string) => {
  await page.goto(`/collections/${slug}`);
  await expect(page.locator("article.v5-card").first()).toBeVisible();
  return page.locator("article.v5-card a[href^='/products/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!.split("/").pop()!))]);
};

test.describe.serial("P0: collections, inventory desk and analytics (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("merchant inventory/collections");
  });
  test.afterAll(async () => {
    for (const slug of created.collections) await sb.from("collections").delete().eq("slug", slug);
    if (created.product) await sb.from("products").update({ status: "archived" }).eq("id", created.product);
    if (created.ghostProduct) await sb.from("products").delete().eq("id", created.ghostProduct);
  });

  test("manual collection: search, add, storefront shows exactly that product", async ({ page }) => {
    await signIn(page, "owner");
    const slug = await createCollection(page, `QA Manual ${TAG}`);
    await page.getByLabel("Search products to add").fill("Latitude");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const hit = page.locator("li", { hasText: DELL });
    await hit.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Product added.")).toBeVisible();
    expect(await storefrontHandles(page, slug)).toEqual([DELL]);
  });

  test("automated collection by brand: storefront shows matching products only", async ({ page }) => {
    await signIn(page, "owner");
    const slug = await createCollection(page, `QA Lenovo ${TAG}`, "Lenovo");
    const handles = await storefrontHandles(page, slug);
    expect(handles).toContain(LENOVO);
    expect(handles).not.toContain(DELL);
  });

  test("inventory desk: receive, count, refuse below zero, history; editor refused", async ({ page, browser }) => {
    const p = await sb.from("products").insert({ handle: `qa-inv-${TAG}`, title: `QA Inventory ${TAG}`, status: "active", category: "Laptop" }).select("id").single();
    created.product = p.data!.id;
    const sku = `QA-INV-${TAG}`.toUpperCase();
    const v = await sb.from("product_variants").insert({ product_id: created.product, title: "Default", sku, price_paisa: 5_000_000, inventory_mode: "tracked", quantity_on_hand: 3 }).select("id").single();
    expect(v.error).toBeNull();

    // Soft-deleted tracked variants must not inflate the desk summary or empty-state copy.
    const ghost = await sb
      .from("products")
      .insert({
        handle: `qa-inv-ghost-${TAG}`,
        title: `QA Ghost Inventory ${TAG}`,
        status: "archived",
        category: "Laptop",
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(ghost.error).toBeNull();
    created.ghostProduct = ghost.data!.id;
    await sb.from("product_variants").insert({
      product_id: created.ghostProduct,
      title: "Default",
      sku: `QA-GHOST-${TAG}`,
      price_paisa: 1_000_000,
      inventory_mode: "tracked",
      quantity_on_hand: 1,
    });

    await signIn(page, "manager");
    await page.goto("/admin/inventory?filter=all");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.locator("main")).toContainText(/[1-9]\d* variants track stock/);
    await expect(page.getByText("Nothing matches this filter.")).toHaveCount(0);
    await expect(page.locator(`[data-testid=inventory-row][data-sku="QA-GHOST-${TAG}"]`)).toHaveCount(0);

    await page.goto(`/admin/inventory?q=${encodeURIComponent(sku)}`);
    const row = page.locator(`[data-testid=inventory-row][data-sku="${sku}"]`);
    await expect(row.getByTestId("inventory-qty")).toHaveText("3 · In stock");

    const form = row.getByTestId("inventory-adjust");
    await form.getByLabel("Units (+/−)").fill("2");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("status")).toHaveText("Saved. Stock is now 5.");
    await expect(row.getByTestId("inventory-qty")).toHaveText("5 · In stock");

    await form.getByLabel("Change").selectOption("set");
    await form.getByLabel("Counted").fill("1");
    await form.getByLabel("Reason").selectOption("count_correction");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(row.getByTestId("inventory-qty")).toHaveText("1 · Low");

    await form.getByLabel("Change").selectOption("delta");
    await form.getByLabel("Units (+/−)").fill("-5");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("alert")).toContainText("below 0");
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", v.data!.id).single()).data!.quantity_on_hand).toBe(1);

    const { data: hist } = await sb.from("inventory_ledger").select("delta, quantity_after, reason, actor_user_id").eq("variant_id", v.data!.id).order("created_at");
    expect(hist).toEqual([
      { delta: 2, quantity_after: 5, reason: "stock_received", actor_user_id: fx.staff.manager.id },
      { delta: -4, quantity_after: 1, reason: "count_correction", actor_user_id: fx.staff.manager.id },
    ]);
    await expect(page.locator("table").getByText("Count correction").first()).toBeVisible();

    const ctx = await browser.newContext();
    const ed = await ctx.newPage();
    await signIn(ed, "editor");
    await ed.goto("/admin/inventory");
    await expect(ed).toHaveURL(/\/admin\/forbidden/);
    const r = await ed.request.post("/api/admin/inventory/adjust", {
      headers: { origin: "http://127.0.0.1:3001" },
      data: { variantId: v.data!.id, mode: "delta", amount: 10, reason: "other" },
    });
    expect(r.status()).toBe(403);
    await ctx.close();
  });

  test("analytics: all-time numbers match the database", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto("/admin/analytics?range=all");
    const { count: placed } = await sb.from("orders").select("id", { count: "exact", head: true });
    const { count: delivered } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered");
    const { count: cancelled } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled");
    await expect(page.getByTestId("metric-orders-placed").getByTestId("metric-value")).toHaveText(String(placed));
    await expect(page.getByTestId("metric-delivered").getByTestId("metric-value")).toHaveText(String(delivered));
    await expect(page.getByTestId("metric-cancelled").getByTestId("metric-value")).toHaveText(String(cancelled));
    await expect(page.getByText("An order is not revenue until its cash is recorded.")).toBeVisible();
  });
});
