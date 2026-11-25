/**
 * G15: Settings → Store details no longer has its own business name / email / phone inputs (nothing public read them,
 * and a stale copy could overwrite the Contact & Social values). It shows the Contact & Social values read-only, and
 * saving store settings leaves the stored identity untouched. Isolated stack only.
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("settings journeys need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const owner = fx.staff.owner as { email: string; password: string };

const identityRow = async () => (await sb.from("store_settings").select("value").eq("key", "business_identity").maybeSingle()).data?.value ?? null;

test("Store details shows Contact & Social identity read-only; saving settings does not rewrite it", async ({ page }) => {
  await assertLocalOnly("settings identity journey");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
  await page.goto("/admin/settings");

  const contactName = await page.getByLabel("Business display name").inputValue();
  const summary = page.getByTestId("store-identity-summary");
  await expect(summary).toContainText(contactName);
  await expect(summary.getByRole("link", { name: "Contact & Social" })).toHaveAttribute("href", "#contact-social");
  // The old duplicate inputs are gone.
  await expect(page.getByLabel("Business name", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Support email", { exact: true })).toHaveCount(0);

  const before = await identityRow();
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText("Store settings saved.")).toBeVisible();
  expect(await identityRow()).toEqual(before);
});
