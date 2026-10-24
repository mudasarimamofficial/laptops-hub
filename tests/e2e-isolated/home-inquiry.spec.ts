/**
 * Homepage inquiry (Bible ch. 05) against the ISOLATED stack: local Supabase seeded by seed-isolated.mjs, app on :3001.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("inquiry journeys need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const rowsFor = async (marker: string) =>
  (await sb.from("contact_inquiries").select("id, name, phone, email, subject, message, status").ilike("message", `%${marker}%`)).data || [];

async function signIn(page: Page, role: "manager" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const form = (page: Page) => page.getByRole("form", { name: "Send an inquiry to Laptops HUB" });

test.describe.serial("homepage inquiry (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("inquiry journeys");
  });
  for (const vp of [
    { width: 375, height: 800 },
    { width: 820, height: 1000 },
    { width: 1440, height: 900 },
  ]) {
    test(`section is visible before the footer at ${vp.width}px, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto("/");
      const section = page.locator("#ask");
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole("heading", { name: "Tell us what you're looking for." })).toBeVisible();
      await expect(form(page).getByRole("button", { name: "Send my inquiry" })).toBeVisible();
      const s = (await section.boundingBox())!;
      const f = (await page.locator("footer").boundingBox())!;
      expect(s.y + s.height).toBeLessThanOrEqual(f.y + 1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("invalid input is refused in the browser and nothing is stored", async ({ page }) => {
    await page.goto("/#ask");
    const f = form(page);
    await f.getByRole("button", { name: "Send my inquiry" }).click();
    await expect(f.getByText("Enter your name")).toBeVisible();
    await expect(f.getByText("Give a mobile number or an email")).toBeVisible();
    await f.getByLabel("Full name").fill("Test Buyer");
    await f.getByRole("textbox", { name: /^Mobile number/ }).fill("12345");
    await f.getByLabel("Your requirements or question").fill("short");
    await f.getByRole("button", { name: "Send my inquiry" }).click();
    await expect(f.getByText("Enter a Pakistan mobile number")).toBeVisible();
    await expect(f.getByText("Write at least 10 characters")).toBeVisible();
    await f.getByRole("textbox", { name: /^Mobile number/ }).fill("");
    await f.getByRole("textbox", { name: /^Email/ }).fill("buyer@lh-test.local");
    await f.getByLabel("Phone call").check();
    await f.getByRole("button", { name: "Send my inquiry" }).click();
    await expect(f.getByText("Add a mobile number to be called")).toBeVisible();
  });

  test("valid inquiry is saved once (double click), staff see it and update its status", async ({ page, browser }) => {
    const marker = `home-inq-${Date.now()}`;
    await page.goto("/#ask");
    const f = form(page);
    await f.getByLabel("Full name").fill("Home Inquiry Test");
    await f.getByRole("textbox", { name: /^Mobile number/ }).fill("0300 1234567");
    await f.getByLabel("Topic").selectOption("Laptop recommendation");
    await f.getByLabel(/Budget/).selectOption("Rs 40,000 – 60,000");
    await f.getByLabel(/Main use/).fill("Programming");
    await f.getByLabel("Phone call").check();
    await f.getByLabel("Your requirements or question").fill(`Need 16GB RAM for coding. ${marker}`);
    const button = f.getByRole("button", { name: "Send my inquiry" });
    await button.dblclick();
    await expect(page.getByRole("status").filter({ hasText: "Your inquiry has been received." })).toBeVisible();
    await expect.poll(async () => (await rowsFor(marker)).length).toBe(1);
    const [row] = await rowsFor(marker);
    expect(row).toMatchObject({ name: "Home Inquiry Test", phone: "0300 1234567", email: null, subject: "Homepage inquiry · Laptop recommendation", status: "new" });
    expect(row.message).toContain("Budget: Rs 40,000 – 60,000\nUse: Programming\nPreferred contact: phone call");

    await signIn(page, "manager");
    await page.goto("/admin/inquiries");
    const card = page.getByTestId("inquiry").filter({ hasText: marker });
    await expect(card.getByRole("link", { name: "0300 1234567" })).toHaveAttribute("href", "tel:03001234567");
    await expect(card).toContainText("Homepage inquiry · Laptop recommendation");
    await card.getByRole("button", { name: "Being handled" }).click();
    await expect(card.getByRole("button", { name: "Being handled" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await rowsFor(marker))[0].status).toBe("open");
    const { count } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "inquiry.status").eq("entity_id", row.id);
    expect(count).toBe(1);

    // Editors do not see customer contact details.
    const ctx = await browser.newContext();
    const editor = await ctx.newPage();
    await signIn(editor, "editor");
    await editor.goto("/admin/inquiries");
    await expect(editor).toHaveURL(/\/admin\/forbidden/);
    await ctx.close();
  });

  test("bots, cross-site posts, server errors and offline submissions are handled truthfully", async ({ page }) => {
    await page.goto("/");
    const origin = new URL(page.url()).origin;
    const marker = `bot-${Date.now()}`;
    // Honeypot: accepted silently, nothing stored.
    let r = await page.request.post("/api/contact", { headers: { origin, "x-forwarded-for": "198.51.100.40" }, data: { source: "home", name: "Bot", phone: "03001234567", message: `spam ${marker}`, company: "x" } });
    expect(r.status()).toBe(200);
    expect(await rowsFor(marker)).toHaveLength(0);
    r = await page.request.post("/api/contact", { headers: { origin: "https://evil.example" }, data: { source: "home", name: "X", phone: "03001234567", message: "cross-site message" } });
    expect(r.status()).toBe(403);

    // Server failure → error shown, never a success message.
    await page.route("**/api/contact", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "submit_failed" }) }));
    await page.goto("/#ask");
    const f = form(page);
    await f.getByLabel("Full name").fill("Error Case");
    await f.getByRole("textbox", { name: /^Email/ }).fill("err@lh-test.local");
    await f.getByLabel("Your requirements or question").fill("Testing the failure path please.");
    await f.getByRole("button", { name: "Send my inquiry" }).click();
    await expect(f.getByRole("alert")).toContainText("could not be saved");
    await expect(page.getByText("Your inquiry has been received.")).toHaveCount(0);
    // Offline.
    await page.unroute("**/api/contact");
    await page.route("**/api/contact", (route) => route.abort("internetdisconnected"));
    await f.getByRole("button", { name: "Send my inquiry" }).click();
    await expect(f.getByRole("alert")).toContainText("could not be sent");
  });
});
