/**
 * Global admin search and keyboard shortcuts on the ISOLATED stack.
 *  - Ctrl+K anywhere and "/" outside text fields open it; Esc closes and gives focus back; ↑/↓ + Enter open a result
 *  - products found by title and SKU, orders by order number and phone digits
 *  - role scoping on the server: editors get no orders, fulfillment gets no products; sections follow the nav rules
 *  - results carry identifiers/statuses only (no customer name or phone); filter-syntax input is searched as text
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const P = fx.products[0] as { handle: string; title: string; variantId: string; pricePaisa: number };
const RUN = Date.now().toString(36).toUpperCase().slice(-6);
const ORDER = `LH-SANDBOX-SRCH-${RUN}`;
const NAME = `SANDBOX Searcher ${RUN}`;
const PHONE = "3007654321";
let sku = "";

async function signIn(page: Page, who: "owner" | "editor" | "fulfillment") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[who].email);
  await page.getByLabel("Password").fill(fx.staff[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
  await expect(page.getByTestId("admin-search-open")).toBeEnabled();
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Search admin" });
const box = (page: Page) => dialog(page).getByRole("combobox");
const options = (page: Page, group?: string) => dialog(page).locator(group ? `[role=option][data-group="${group}"]` : "[role=option]");

test.describe.serial("P0: global admin search and shortcuts (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("admin search");
    await sb.from("orders").delete().like("order_number", "LH-SANDBOX-SRCH-%");
    const { data: o, error } = await sb
      .from("orders")
      .insert({ order_number: ORDER, status: "placed", customer_name: NAME, customer_phone_e164: `+92${PHONE}`, customer_phone_normalized: PHONE, subtotal_paisa: P.pricePaisa, total_due_paisa: P.pricePaisa, idempotency_key: `sandbox-${ORDER}` })
      .select("id")
      .single();
    expect(error).toBeNull();
    await sb.from("order_items").insert({ order_id: o!.id, handle: P.handle, title_snapshot: P.title, unit_price_paisa: P.pricePaisa, quantity: 1, line_total_paisa: P.pricePaisa });
    sku = (await sb.from("product_variants").select("sku").eq("id", P.variantId).single()).data!.sku;
    expect(sku).toBeTruthy();
  });
  test.afterAll(async () => {
    await sb.from("orders").delete().like("order_number", "LH-SANDBOX-SRCH-%");
  });

  test("owner: Ctrl+K and '/' open it, Esc closes; product by SKU and order by phone open with the keyboard", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto("/admin/inventory");

    await page.keyboard.press("Control+k");
    await expect(dialog(page)).toBeVisible();
    await expect(box(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId("admin-search-open")).not.toBeFocused(); // focus goes back to where it was (body)

    // "/" opens it from the page, but typing "/" inside a field does not.
    await page.keyboard.press("/");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");

    // Product by SKU → Enter opens the product editor.
    await page.keyboard.press("Control+k");
    await box(page).fill(sku);
    await expect(options(page, "Products").first()).toContainText(P.title);
    await expect(options(page, "Products").first()).toContainText(sku);
    // Move to the first product with the arrow keys (sections may be listed first).
    const all = await options(page).allTextContents();
    const idx = (await options(page).evaluateAll((els) => els.findIndex((e) => e.getAttribute("data-group") === "Products")));
    expect(idx).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < idx; i++) await box(page).press("ArrowDown");
    await expect(options(page).nth(idx)).toHaveAttribute("aria-selected", "true");
    await box(page).press("Enter");
    await page.waitForURL(new RegExp(`/admin/products/${P.handle}$`));
    expect(all.length).toBeGreaterThan(0);

    // Order by phone digits typed the way people write them.
    await page.keyboard.press("Control+k");
    await box(page).fill("0300 7654321");
    const order = options(page, "Orders").filter({ hasText: ORDER });
    await expect(order).toHaveCount(1);
    await expect(order).toContainText("placed");
    await order.click();
    await page.waitForURL(new RegExp(`/admin/orders/${ORDER}$`));
  });

  test("API: identifiers only, role-scoped, safe with filter syntax; anonymous refused", async ({ page, request }) => {
    expect((await request.get(`/api/admin/search?q=${ORDER}`)).status()).toBe(401);

    await signIn(page, "owner");
    const raw = await (await page.request.get(`/api/admin/search?q=${encodeURIComponent(ORDER)}`)).text();
    const body = JSON.parse(raw);
    expect(body.orders).toEqual([{ orderNumber: ORDER, status: "placed", paymentStatus: expect.any(String), totalDuePaisa: P.pricePaisa }]);
    expect(raw).not.toContain(NAME);
    expect(raw).not.toContain(PHONE);

    for (const q of ["a,status.eq.draft", "x)or(id.not.is.null", "100%", '"\\']) {
      const r = await page.request.get(`/api/admin/search?q=${encodeURIComponent(q)}`);
      expect(r.status(), q).toBe(200);
    }
    // A filter-syntax term matches nothing instead of widening the query to every row.
    const widened = await (await page.request.get(`/api/admin/search?q=${encodeURIComponent("zz,order_number.ilike.*")}`)).json();
    expect(widened.orders).toEqual([]);
  });

  test("editor: products and editor sections only — no orders", async ({ page }) => {
    await signIn(page, "editor");
    const body = await (await page.request.get(`/api/admin/search?q=${encodeURIComponent(ORDER)}`)).json();
    expect(body.orders).toEqual([]);
    const prod = await (await page.request.get(`/api/admin/search?q=${encodeURIComponent(sku)}`)).json();
    expect(prod.products.map((p: { handle: string }) => p.handle)).toContain(P.handle);

    await page.keyboard.press("Control+k");
    await box(page).fill("order");
    await expect(dialog(page).getByRole("status")).not.toHaveText("Searching…");
    await expect(options(page, "Go to").filter({ hasText: /^Go to\s*Orders/ })).toHaveCount(0);
    await expect(options(page, "Orders")).toHaveCount(0);
  });

  test("fulfillment: orders only — no products, no catalog sections", async ({ page }) => {
    await signIn(page, "fulfillment");
    const prod = await (await page.request.get(`/api/admin/search?q=${encodeURIComponent(sku)}`)).json();
    expect(prod.products).toEqual([]);
    await page.keyboard.press("Control+k");
    await box(page).fill(ORDER);
    await expect(options(page, "Orders").filter({ hasText: ORDER })).toHaveCount(1);
    await box(page).fill("product");
    await expect(dialog(page).getByRole("status")).toContainText(/Nothing found|to choose/);
    await expect(options(page, "Products")).toHaveCount(0);
    await expect(options(page, "Go to").filter({ hasText: "All products" })).toHaveCount(0);
  });

  test("owner: ? opens shortcuts help; G then O goes to Orders", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto("/admin");
    await expect(page.getByTestId("admin-shortcuts-open")).toBeVisible();

    await page.keyboard.press("Shift+/"); // "?"
    await expect(page.getByTestId("admin-shortcuts-dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("admin-shortcuts-dialog")).toHaveCount(0);

    // Chord navigation (Shopify-style): press G, then the destination letter.
    await page.locator("body").click({ position: { x: 8, y: 8 } });
    await page.keyboard.press("g");
    await page.keyboard.press("o");
    await page.waitForURL(/\/admin\/orders$/);
  });
});
