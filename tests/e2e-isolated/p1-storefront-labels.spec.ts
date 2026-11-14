/**
 * Client request (Nov 2026): no catalog counts ("226 listings", "View all 170", "N products in the catalog"), no
 * story angle counter ("Front view · 1/4") and no numbered section labels ("02 — PRODUCT STORY") on the storefront.
 * Verifies the default (hidden), that the hero price tag shows the product name (not image alt text), and that the
 * owner can turn counts back on in Admin → Settings with persisted read-back. ISOLATED stack only.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const UNWANTED = [/\b\d+ listings\b/i, /products in the catalog/i, /View all \d+/i, /\b\d{2} — [A-Z]/, /(Front|Left|Right|Rear) (view|angle) · \d\/4/i, /Laptops HUB hero/i];

async function visibleText(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => document.body.innerText);
}

test.describe.serial("P1: storefront labels and counts (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("storefront labels");
    await sb.from("store_settings").delete().eq("key", "storefront_presentation");
  });
  test.afterAll(async () => {
    await sb.from("store_settings").delete().eq("key", "storefront_presentation");
  });

  test("default: no counts, no section numbers, no angle counter, no alt-text captions", async ({ page }) => {
    for (const path of ["/", "/collections/all"]) {
      const text = await visibleText(page, path);
      for (const re of UNWANTED) expect(text, `${path} shows ${re}`).not.toMatch(re);
    }
    await page.goto("/");
    // Hero price tag names the product; the image keeps its descriptive alt text.
    const tag = page.locator(".v5-hero-tag");
    await expect(tag).not.toContainText("hero");
    await page.screenshot({ path: "test-results/p0-evidence/home-labels-default.png" });
  });

  test("owner turns catalog counts back on in Admin; persisted and shown publicly", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.goto("/admin/settings");
    const box = page.getByRole("checkbox", { name: /Show catalog counts/ });
    await expect(box).not.toBeChecked();
    await box.check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Store settings saved.")).toBeVisible();
    const { data } = await sb.from("store_settings").select("value").eq("key", "storefront_presentation").single();
    expect(data!.value).toEqual({ showCatalogCounts: true, showStoryAngleLabels: false, showSectionNumbers: false });
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Show catalog counts/ })).toBeChecked();
    const text = await visibleText(page, "/");
    expect(text).toMatch(/products in the catalog/i);
    expect(text).not.toMatch(/\b\d{2} — [A-Z]/); // other switches untouched
  });
});
