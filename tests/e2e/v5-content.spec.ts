import { test, expect } from "@playwright/test";

/**
 * V5 content pages against a normal build (V5_CONTENT_PREVIEW unset). Every CMS row is unpublished today,
 * so pages must render the gated V5 shell, stay out of search engines, and never show template copy.
 * Contact submissions are mocked in the browser; the real API only receives invalid / cross-site requests,
 * which it must reject without storing anything.
 */
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PAGES = ["about", "why-laptops-hub", "contact", "faq", "shipping", "returns", "warranty", "condition-guide", "how-to-choose", "comparison-guide", "order-inquiries", "privacy", "terms"];
const ARTICLES = ["processor-generations-explained", "how-much-ram", "choosing-storage", "business-laptop-lines"];

for (const slug of PAGES) {
  test(`gated page /pages/${slug}`, async ({ page }) => {
    const res = await page.goto(`${base}/pages/${slug}`, { waitUntil: "load" });
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("BEING FINALISED").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const main = await page.locator("main").innerText();
    // No unapproved template copy, owner checklists or prototype wording.
    expect(main).not.toMatch(/DRAFT · EDITORIAL REVIEW|Founding year|Business registration|Shopify|prototype|not connected/i);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
}

test("guides index and articles are gated and noindex", async ({ page }) => {
  for (const path of ["/guides", ...ARTICLES.map((a) => `/guides/${a}`)]) {
    const res = await page.goto(base + path, { waitUntil: "load" });
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("Read guide →")).toHaveCount(0);
  }
});

test("missing content routes 404", async ({ page }) => {
  expect((await page.goto(`${base}/pages/no-such-page`))?.status()).toBe(404);
  expect((await page.goto(`${base}/guides/no-such-article`))?.status()).toBe(404);
});

test("sitemap lists no unpublished content", async ({ request }) => {
  const xml = await (await request.get(`${base}/sitemap.xml`)).text();
  expect(xml).not.toMatch(/\/pages\/|\/guides/);
});

test("contact form: validation, submitting, failure, success (mocked)", async ({ page }) => {
  let calls = 0;
  let mode: "hang" | "fail" | "ok" = "fail";
  await page.route("**/api/contact", (route) => {
    calls++;
    if (mode === "hang") return;
    if (mode === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"submit_failed"}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto(`${base}/pages/contact`, { waitUntil: "load" });
  const send = page.getByRole("button", { name: "Send message" });

  // Invalid: client validation, nothing posted.
  await send.click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Write at least 10 characters")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("textbox", { name: "Phone or WhatsApp (optional)" }).fill("12ab");
  await send.click();
  await expect(page.getByText("Enter a valid phone number or leave it blank")).toBeVisible();
  expect(calls).toBe(0);

  await page.getByRole("textbox", { name: "Name" }).fill("QA Test");
  await page.getByRole("textbox", { name: "Email" }).fill("qa@example.com");
  await page.getByRole("textbox", { name: "Phone or WhatsApp (optional)" }).fill("");
  await page.getByRole("textbox", { name: "Message" }).fill("Testing the contact form states.");

  // Server failure: no success claim, error announced.
  await send.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("could not be saved");
  await expect(page.getByText("Message received")).toHaveCount(0);

  // Success only after the server says ok.
  mode = "ok";
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "Message received" })).toBeVisible();
  await page.getByRole("button", { name: "Write another message" }).click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("");
  expect(calls).toBe(2);
});

test("contact form shows the submitting state", async ({ page }) => {
  await page.route("**/api/contact", () => {
    /* never answers */
  });
  await page.goto(`${base}/pages/contact`, { waitUntil: "load" });
  await page.getByRole("textbox", { name: "Name" }).fill("QA Test");
  await page.getByRole("textbox", { name: "Email" }).fill("qa@example.com");
  await page.getByRole("textbox", { name: "Message" }).fill("Testing the submitting state.");
  await page.getByRole("button", { name: "Send message" }).click();
  const btn = page.getByRole("button", { name: "Sending…" });
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("aria-busy", "true");
});

test("contact API rejects invalid and cross-site posts without storing", async ({ request }) => {
  // 400 (validation) or 429 (the real rate limiter, which runs first) — either way nothing is stored.
  const bad = await request.post(`${base}/api/contact`, { data: { name: "x", message: "hi" } });
  expect([400, 429]).toContain(bad.status());
  const noRoute = await request.post(`${base}/api/contact`, { data: { name: "QA Test", message: "Long enough message" } });
  expect([400, 429]).toContain(noRoute.status());
  const cross = await request.post(`${base}/api/contact`, {
    headers: { origin: "https://evil.example" },
    data: { name: "QA Test", email: "qa@example.com", message: "Long enough message" },
  });
  expect(cross.status()).toBe(403);
});

test("help side navigation marks unpublished pages and current page", async ({ page }) => {
  await page.goto(`${base}/pages/warranty`, { waitUntil: "load" });
  const nav = page.getByRole("complementary", { name: "Page navigation" });
  await expect(nav.getByRole("link", { name: /Warranty information/ })).toHaveAttribute("aria-current", "page");
  expect(await nav.getByText("SOON").count()).toBe(13);
});
