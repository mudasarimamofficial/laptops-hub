/**
 * G04 (P0): laptop specs and condition are editable in Admin → product → Specifications, and the storefront product
 * page follows. Isolated stack only; the product's original specs are restored afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const HANDLE: string = fx.products[0].handle;
const RUN = Date.now().toString(36);
const DISPLAY = `QA 14-inch FHD ${RUN}`;

let original: Record<string, unknown> | null = null;

async function signIn(page: Page, role: "owner" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function specsNow() {
  const { data } = await sb.from("products").select("specs").eq("handle", HANDLE).single();
  return (data!.specs || {}) as Record<string, unknown>;
}

test.describe.serial("Product specifications editor (G04, isolated)", () => {
  test.beforeAll(async () => {
    original = await specsNow();
  });
  test.afterAll(async () => {
    if (original) await sb.from("products").update({ specs: original }).eq("handle", HANDLE);
  });

  test("invalid numbers are refused and nothing is saved", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto(`/admin/products/${HANDLE}`);
    const form = page.getByTestId("product-specs-form");
    await form.getByLabel("Processor generation").fill("eight");
    await form.getByRole("button", { name: "Save specifications" }).click();
    await expect(form.getByTestId("spec-error")).toContainText("must be numbers");
    await form.getByLabel("Processor generation").fill("8.5");
    await form.getByRole("button", { name: "Save specifications" }).click();
    await expect(form.getByTestId("spec-error")).toContainText(/whole number/i);
    expect(await specsNow()).toEqual(original);
  });

  test("edit RAM, storage, condition, touch and a table row → stored → product page shows them", async ({ page, request }) => {
    await signIn(page, "owner");
    await page.goto(`/admin/products/${HANDLE}`);
    const form = page.getByTestId("product-specs-form");
    await form.getByLabel("RAM (GB)").fill("32");
    await form.getByLabel("Storage (GB)").fill("1024");
    await form.getByLabel("Condition", { exact: true }).selectOption("Used");
    await form.getByLabel("Touch screen").check();
    await form.getByLabel("Table: Display").fill(DISPLAY);
    await form.getByRole("button", { name: "Save specifications" }).click();
    await expect(form.getByTestId("spec-saved")).toBeVisible();

    const s = await specsNow();
    expect(s.ram).toBe("32GB");
    expect(s.storage).toBe("1024GB");
    expect(s.condition).toBe("Used");
    expect(s.touch).toBe(true);
    expect(s.Display).toBe(DISPLAY);
    // Keys the editor does not manage are kept exactly.
    const managed = new Set(["model", "config", "cpu", "gen", "ram", "storage", "sto", "size", "touch", "condition", "Processor", "Memory", "Storage", "Graphics", "Display", "Resolution / panel", "Touch", "Operating system", "Condition"]);
    for (const [k, v] of Object.entries(original || {})) if (!managed.has(k)) expect(s[k], k).toEqual(v);

    // Reload: the form shows the stored values.
    await page.reload();
    await expect(page.getByTestId("product-specs-form").getByLabel("RAM (GB)")).toHaveValue("32");
    await expect(page.getByTestId("product-specs-form").getByLabel("Table: Display")).toHaveValue(DISPLAY);

    // Storefront: key specs and spec table follow (catalog cache is expired by the save).
    await expect
      .poll(async () => {
        const html = await (await request.get(`/products/${HANDLE}`)).text();
        return html.includes(DISPLAY) && html.includes("32GB") && html.includes("1TB");
      }, { timeout: 20_000 })
      .toBe(true);
    await page.goto(`/products/${HANDLE}`);
    await expect(page.getByTestId("pdp-key-specs")).toContainText("32GB");
    await expect(page.getByTestId("pdp-key-specs")).toContainText("1TB");
    await expect(page.getByRole("region", { name: /specifications/i }).or(page.locator('[aria-labelledby="pdp-specs"]'))).toContainText(DISPLAY);
  });
});
