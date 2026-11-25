/**
 * Product list bulk selection on the ISOLATED stack: tick products, select-all (with the mixed state), quick actions
 * through the existing bulk API, "Edit prices in bulk editor" carries the ticked handles, cross-site POSTs refused.
 * Product flags are restored afterwards.
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const HANDLES: string[] = fx.products.map((p: { handle: string }) => p.handle);

test.describe.serial("Products: bulk selection (isolated)", () => {
  let original: { handle: string; featured: boolean; status: string }[] = [];
  test.beforeAll(async () => {
    await assertLocalOnly("product bulk selection");
    const { data } = await sb.from("products").select("handle, featured, status").in("handle", HANDLES);
    original = data ?? [];
  });
  test.afterAll(async () => {
    for (const o of original) await sb.from("products").update({ featured: o.featured, status: o.status }).eq("handle", o.handle);
  });

  test("tick, select all, feature/unfeature, open in bulk editor", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.goto("/admin/products");

    await expect(page.getByTestId("bulk-bar")).toHaveCount(0);
    // Each product renders a mobile card and a desktop table row; only one of the two checkboxes is visible.
    const boxes = page.getByTestId("product-select").filter({ visible: true });
    const total = await boxes.count();
    expect(total).toBeGreaterThanOrEqual(2);
    await boxes.first().check();
    await expect(page.getByTestId("bulk-count")).toHaveText("1 selected");
    if (total > 1) {
      expect(await page.getByTestId("product-select-all").evaluate((el) => (el as HTMLInputElement).indeterminate)).toBe(true);
    }
    await page.getByTestId("product-select-all").check();
    await expect(page.getByTestId("bulk-count")).toHaveText(`${total} selected`);
    await page.getByTestId("product-select-all").uncheck();
    await expect(page.getByTestId("bulk-bar")).toHaveCount(0);

    // Feature exactly the two fixture products.
    for (const h of HANDLES) await boxes.and(page.locator(`[data-handle="${h}"]`)).check();
    await page.getByTestId("bulk-feature").click();
    await expect(page.getByTestId("bulk-msg")).toHaveText(`Feature: ${HANDLES.length} updated.`);
    const { data: after } = await sb.from("products").select("featured").in("handle", HANDLES);
    expect(after?.every((r) => r.featured)).toBe(true);
    // Selection clears after an action.
    await expect(page.getByTestId("bulk-count")).toHaveCount(0);

    // Archive asks first; dismissing changes nothing.
    await boxes.and(page.locator(`[data-handle="${HANDLES[0]}"]`)).check();
    page.once("dialog", (d) => d.dismiss());
    await page.getByTestId("bulk-archive").click();
    const { data: still } = await sb.from("products").select("status").eq("handle", HANDLES[0]).single();
    expect(still?.status).not.toBe("archived");

    // Open the ticked products in the bulk editor.
    await boxes.and(page.locator(`[data-handle="${HANDLES[1]}"]`)).check();
    await page.getByTestId("bulk-open-editor").click();
    await page.waitForURL(/\/admin\/products\/bulk\?handles=/);
    for (const h of HANDLES) await expect(page.getByText(h, { exact: true }).or(page.locator(`input[value="${h}"]`)).first()).toBeVisible();

    // Cross-site POSTs to the bulk API are refused.
    const r = await page.request.post("/api/admin/products/bulk", {
      headers: { origin: "https://evil.example" },
      data: { items: [{ handle: HANDLES[0], featured: false }] },
    });
    expect(r.status()).toBe(403);
  });
});
