/**
 * PDP WhatsApp order messaging — variant/qty/campaign/recipient/fallback.
 * Isolated stack; temporary recipient restored after run. Does not send WhatsApp messages.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { fmtPkr } from "../../src/lib/catalog/v5-model";
import { priceWithCampaign, type DiscountCampaign } from "../../src/lib/commerce/pricing";
import { DEFAULT_CONTACT_SOCIAL, parseContactSocial } from "../../src/lib/content/contact-social";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) {
  throw new Error("whatsapp order journey needs local Supabase");
}
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
const RUN = randomUUID().slice(0, 6);
const HANDLE = `qa-wa-order-${RUN}`;
const KEY = "contact_social";
const TEST_RECIPIENT = "923009998877"; // fixture only — not a merchant number

async function signInOwner(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function liveStorewideCampaign(): Promise<DiscountCampaign | null> {
  const { data } = await sb.from("discount_campaigns").select("*").in("status", ["active", "scheduled"]).limit(10);
  for (const r of data || []) {
    if (r.scope !== "storewide" || r.code_required) continue;
    return {
      id: r.id,
      name: r.name,
      description: r.description || "",
      kind: r.kind,
      value: Number(r.value),
      scope: r.scope,
      status: r.status,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      announcement: r.announcement || "",
      showAnnouncement: !!r.show_announcement,
      codeRequired: !!r.code_required,
    };
  }
  return null;
}

test.describe.serial("contact social whatsapp order messaging", () => {
  let previousContact: unknown = null;
  const prices = { a: 8_500_000, b: 9_500_000 }; // paisa list

  test.beforeAll(async () => {
    previousContact = (await sb.from("store_settings").select("value").eq("key", KEY).maybeSingle()).data?.value ?? null;
  });

  test.afterAll(async () => {
    if (previousContact == null) await sb.from("store_settings").delete().eq("key", KEY);
    else await sb.from("store_settings").upsert({ key: KEY, value: previousContact, updated_at: new Date().toISOString() });
    const { data: p } = await sb.from("products").select("id").eq("handle", HANDLE).maybeSingle();
    if (p) {
      await sb.from("product_variants").delete().eq("product_id", p.id);
      await sb.from("products").delete().eq("id", p.id);
    }
  });

  test("create multi-variant product and configure test recipient", async ({ page }) => {
    await signInOwner(page);
    const create = await page.request.post("/api/admin/products", {
      headers: { origin: ORIGIN },
      data: {
        title: `QA WhatsApp Order ${RUN}`,
        handle: HANDLE,
        status: "active",
        manufacturer: "Dell",
        category: "Laptop",
        productType: "Laptop",
        pricePkr: 85000,
      },
    });
    expect(create.status(), await create.text()).toBeLessThan(300);
    const put = await page.request.put(`/api/admin/products/${HANDLE}/variants`, {
      headers: { origin: ORIGIN },
      data: {
        optionNames: ["RAM", "Storage"],
        variants: [
          {
            sku: `QA-WA-${RUN}-8-256`,
            pricePkr: prices.a / 100,
            optionValues: { RAM: "8GB", Storage: "256GB" },
            inventoryMode: "untracked",
            position: 1,
          },
          {
            sku: `QA-WA-${RUN}-16-512`,
            pricePkr: prices.b / 100,
            optionValues: { RAM: "16GB", Storage: "512GB" },
            inventoryMode: "untracked",
            position: 2,
          },
        ],
      },
    });
    expect(put.status(), await put.text()).toBeLessThan(300);
    const touch = await page.request.patch(`/api/admin/products/${HANDLE}`, {
      headers: { origin: ORIGIN },
      data: { status: "active" },
    });
    expect(touch.status(), await touch.text()).toBeLessThan(300);

    const base = parseContactSocial(previousContact);
    const next = {
      ...base,
      whatsapp: { ...base.whatsapp, recipientDigits: TEST_RECIPIENT, orderingEnabled: true },
    };
    const save = await page.request.put("/api/admin/store-settings", {
      headers: { origin: ORIGIN },
      data: { contactSocial: next },
    });
    expect(save.status(), await save.text()).toBeLessThan(300);
  });

  test("multi-variant: message reflects selection, qty, campaign price, and wa.me recipient", async ({ page }) => {
    const campaign = await liveStorewideCampaign();
    const unitB = priceWithCampaign(prices.b, campaign);
    const qty = 2;
    const expectedUnit = fmtPkr(unitB.sellingPaisa);
    const expectedSub = fmtPkr(unitB.sellingPaisa * qty);

    await page.addInitScript(() => {
      (window as unknown as { __waOpened: string[] }).__waOpened = [];
      window.open = ((url?: string | URL) => {
        (window as unknown as { __waOpened: string[] }).__waOpened.push(String(url ?? ""));
        return null;
      }) as typeof window.open;
    });

    await page.goto(`/products/${HANDLE}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("radiogroup", { name: "RAM" }).getByRole("radio", { name: "16GB" }).click();
    await page.getByRole("radiogroup", { name: "Storage" }).getByRole("radio", { name: "512GB" }).click();
    await page.getByRole("button", { name: "Increase quantity" }).click();

    const wa = page.getByTestId("pdp-whatsapp-cta");
    await expect(wa).toHaveAttribute("data-wa-prefilled", "1");
    await expect(page.getByTestId("pdp-primary-cta")).toBeVisible();
    await wa.click();

    const url = await page.evaluate(() => (window as unknown as { __waOpened: string[] }).__waOpened?.[0] || "");
    expect(url).toMatch(new RegExp(`^https://wa\\.me/${TEST_RECIPIENT}\\?text=`));
    const text = decodeURIComponent(url.split("?text=")[1] || "");
    expect(text).toContain(`QA-WA-${RUN}-16-512`);
    expect(text).toMatch(/Quantity: 2/);
    expect(text).toContain(expectedUnit);
    expect(text).toContain(expectedSub);
    expect(text).toMatch(/16GB/);
    expect(text).toMatch(/512GB/);
    expect(text).toContain(`/products/${HANDLE}`);
  });

  test("no-recipient fallback still works after clearing recipient", async ({ page }) => {
    await signInOwner(page);
    const base = parseContactSocial(
      (await sb.from("store_settings").select("value").eq("key", KEY).maybeSingle()).data?.value,
    );
    const cleared = {
      ...base,
      whatsapp: { ...base.whatsapp, recipientDigits: "" },
    };
    const save = await page.request.put("/api/admin/store-settings", {
      headers: { origin: ORIGIN },
      data: { contactSocial: cleared },
    });
    expect(save.status(), await save.text()).toBeLessThan(300);

    await page.goto(`/products/${HANDLE}`, { waitUntil: "domcontentloaded" });
    const wa = page.getByTestId("pdp-whatsapp-cta");
    await expect(wa).toHaveAttribute("data-wa-prefilled", "0");
    await wa.click();
    await expect(page.getByTestId("whatsapp-message-fallback")).toBeVisible();
    const text = await page.getByTestId("whatsapp-message-text").inputValue();
    expect(text.length).toBeGreaterThan(40);
    await expect(page.getByTestId("whatsapp-open-general")).toHaveAttribute(
      "href",
      DEFAULT_CONTACT_SOCIAL.whatsapp.generalUrl,
    );
  });

  test("single-variant catalog PDP keeps primary ATC and WhatsApp secondary", async ({ page }) => {
    await page.goto("/products/dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage", { waitUntil: "domcontentloaded" });
    const primary = page.getByTestId("pdp-primary-cta");
    const wa = page.getByTestId("pdp-whatsapp-cta");
    await expect(primary).toBeVisible();
    await expect(wa).toBeVisible();
    const pb = await primary.boundingBox();
    const wb = await wa.boundingBox();
    expect(pb && wb && wb.y > pb.y).toBeTruthy();
    const mode = await primary.getAttribute("data-cta");
    await primary.click();
    if (mode === "buy_now") {
      await expect(page).toHaveURL(/\/checkout/, { timeout: 10000 });
    } else {
      // Cart drawer opens; float may hide.
      await expect(page.getByRole("button", { name: "Close cart" })).toBeVisible({ timeout: 10000 });
    }
  });
});
