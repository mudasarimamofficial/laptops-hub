/**
 * Prepared CMS copy (content/drafts) rendered as published pages on the ISOLATED stack: FAQ accordion is keyboard
 * operable, the contact page keeps its working form, no unfinished copy. Restores the rows afterwards.
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("content journeys need a local Supabase");
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const SLUGS = ["about", "why-laptops-hub", "contact", "faq", "condition-guide", "order-inquiries"];
const BANNED = /being finali[sz]ed|pending business approval|we haven[’']t published|will be published here|lorem ipsum/i;

test.describe.serial("prepared content pages (isolated)", () => {
  let saved: { slug: string; status: string; body_html: string | null }[] = [];
  test.beforeAll(async () => {
    saved = (await sb.from("content_pages").select("slug, status, body_html").in("slug", SLUGS)).data || [];
    for (const slug of SLUGS) {
      await sb.from("content_pages").update({ status: "published", body_html: fs.readFileSync(`content/drafts/${slug}.html`, "utf8") }).eq("slug", slug);
    }
  });
  test.afterAll(async () => {
    for (const r of saved) await sb.from("content_pages").update({ status: r.status, body_html: r.body_html }).eq("slug", r.slug);
  });

  for (const slug of SLUGS) {
    test(`/pages/${slug} renders complete copy`, async ({ page }) => {
      const res = await page.goto(`/pages/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(BANNED.test(await page.locator("main").innerText())).toBe(false);
    });
  }

  test("FAQ accordion works with the keyboard", async ({ page }) => {
    await page.goto("/pages/faq");
    const q = page.locator("summary", { hasText: "Which payment methods do you accept?" });
    const answer = page.getByText("Online orders are paid by Cash on Delivery only.");
    await expect(answer).toBeHidden();
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(answer).toBeVisible();
    await page.keyboard.press("Space");
    await expect(answer).toBeHidden();
  });

  test("published contact page keeps the working contact form", async ({ page }) => {
    await page.goto("/pages/contact");
    await expect(page.getByRole("heading", { name: "Call us" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
    await expect(page.getByRole("link", { name: "0313 6565663" })).toHaveAttribute("href", "tel:+923136565663");
  });
});
