/**
 * Contact & Social admin save/reload + phone list controls.
 * Isolated stack only — restores original contact_social after the run.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { DEFAULT_CONTACT_SOCIAL } from "../../src/lib/content/contact-social";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) {
  throw new Error("contact-social admin persist needs local Supabase");
}
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
const KEY = "contact_social";
const MARKER_DIGITS = `${Date.now()}`.slice(-6);

async function signInOwner(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

test.describe.serial("contact social admin persistence", () => {
  let previous: unknown = null;

  test.beforeAll(async () => {
    previous = (await sb.from("store_settings").select("value").eq("key", KEY).maybeSingle()).data?.value ?? null;
  });

  test.afterAll(async () => {
    if (previous == null) {
      await sb.from("store_settings").delete().eq("key", KEY);
    } else {
      await sb.from("store_settings").upsert({ key: KEY, value: previous, updated_at: new Date().toISOString() });
    }
  });

  test("admin can add/reorder phones, save, and storefront reflects change", async ({ page }) => {
    await signInOwner(page);
    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
    await page.locator("#contact-social").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("contact-phones-editor")).toBeVisible({ timeout: 20000 });

    // Reorder: move first phone down.
    const firstId = DEFAULT_CONTACT_SOCIAL.phones[0].id;
    await page.getByTestId(`contact-phone-down-${firstId}`).click();

    // Add a temporary phone.
    await page.getByTestId("contact-phone-add").click();
    const rows = page.locator("[data-testid^=contact-phone-row-]");
    await expect(rows).toHaveCount(4);
    const newRow = rows.last();
    await newRow.locator("label").filter({ hasText: "Display" }).locator("input").fill(`0300 ${MARKER_DIGITS}`);
    await newRow.locator("label").filter({ hasText: "tel:" }).locator("input").fill(`0300${MARKER_DIGITS}`);

    // Temporary recipient fixture (never a real merchant number).
    await page.getByPlaceholder("923XXXXXXXXX").fill("923001112233");

    const saveRespPromise = page.waitForResponse(
      (r) => r.url().includes("/api/admin/store-settings") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: /Save contact & social/i }).click();
    const saveResp = await saveRespPromise;
    const saveBody = await saveResp.json().catch(() => ({}));
    expect(saveResp.status(), JSON.stringify(saveBody)).toBeLessThan(300);
    await expect(page.getByText(/Contact & social settings saved/i)).toBeVisible({ timeout: 15000 });

    // Reload admin form — values persist.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#contact-social").scrollIntoViewIfNeeded();
    await expect(page.getByPlaceholder("923XXXXXXXXX")).toHaveValue("923001112233");
    await expect(page.locator("[data-testid^=contact-phone-row-]")).toHaveCount(4);

    // Public footer shows the temporary phone after cache invalidation from save.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("site-footer")).toContainText(`0300 ${MARKER_DIGITS}`);

    // Phone order: original p1 was moved down, so p2 should appear before p1 among defaults.
    const phoneHrefs = await page.locator("[data-testid^=footer-phone-]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(phoneHrefs).toContain(`tel:0300${MARKER_DIGITS}`);
  });

  test("empty phone list persists without resurrecting defaults", async ({ page }) => {
    await signInOwner(page);
    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
    await page.locator("#contact-social").scrollIntoViewIfNeeded();

    // Remove every phone row.
    for (;;) {
      const remove = page.locator("[data-testid^=contact-phone-remove-]").first();
      if ((await remove.count()) === 0) break;
      await remove.click();
    }
    await expect(page.getByTestId("contact-phones-empty")).toBeVisible();
    await page.getByRole("button", { name: /Save contact & social/i }).click();
    await expect(page.getByText(/Contact & social settings saved/i)).toBeVisible({ timeout: 15000 });

    const stored = (await sb.from("store_settings").select("value").eq("key", KEY).single()).data?.value as {
      phones?: unknown[];
    };
    expect(Array.isArray(stored?.phones) && stored.phones.length === 0).toBeTruthy();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-testid^=footer-phone-]")).toHaveCount(0);

    // Restore merchant defaults via form reset + save for remaining tests / afterAll safety.
    await page.goto("/admin/settings");
    await page.locator("#contact-social").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /Reset form to merchant defaults/i }).click();
    await page.getByRole("button", { name: /Save contact & social/i }).click();
    await expect(page.getByText(/Contact & social settings saved/i)).toBeVisible({ timeout: 15000 });
  });
});
