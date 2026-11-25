/**
 * G11: category is chosen from the names the storefront understands, and brand/category saves fix the letter case of a
 * known name ("dell" → "Dell"), so a product is not silently left out of its brand collection or filed as "Laptop".
 * Isolated stack only; the product's original brand and category are restored afterwards.
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { ORIGIN } from "./helpers/origin";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const HANDLE: string = fx.products[0].handle;

test("category select offers the storefront categories; saves normalise brand and category case", async ({ page }) => {
  const { data: before } = await sb.from("products").select("manufacturer, category").eq("handle", HANDLE).single();
  try {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);

    await page.goto(`/admin/products/${HANDLE}`);
    const options = await page.getByTestId("product-category").locator("option").allTextContents();
    expect(options.slice(0, 7)).toEqual(["Not set (shown as Laptop)", "Laptop", "Gaming laptop", "Chromebook", "MacBook", "Tablet", "Accessory"]);

    const res = await page.request.patch(`/api/admin/products/${HANDLE}`, {
      headers: { origin: ORIGIN },
      data: { manufacturer: "  dell ", category: "gaming LAPTOP" },
    });
    expect(res.status(), await res.text()).toBe(200);
    const { data: after } = await sb.from("products").select("manufacturer, category").eq("handle", HANDLE).single();
    expect(after).toEqual({ manufacturer: "Dell", category: "Gaming laptop" });

    // Unknown values are kept as typed (never invented), and the form says how the storefront treats them.
    await sb.from("products").update({ category: "Business" }).eq("handle", HANDLE);
    await page.reload();
    await expect(page.getByTestId("product-category")).toHaveValue("Business");
    await expect(page.getByTestId("product-category").locator("option:checked")).toHaveText("Business (not recognised — shown as Laptop)");
  } finally {
    await sb.from("products").update({ manufacturer: before!.manufacturer, category: before!.category }).eq("handle", HANDLE);
  }
});
