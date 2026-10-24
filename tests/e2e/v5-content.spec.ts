import { test, expect, type Page } from "@playwright/test";

/**
 * Content pages against a normal build (V5_CONTENT_PREVIEW unset), safe to run on Production data (read-only):
 * every content route is either published and complete (200, no unfinished copy) or not public (404) and never
 * linked. Contact and inquiry submissions are mocked in the browser; the real API only receives invalid or
 * cross-site requests, which it must reject without storing anything.
 */
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PAGES = ["about", "why-laptops-hub", "contact", "faq", "shipping", "returns", "warranty", "condition-guide", "how-to-choose", "comparison-guide", "order-inquiries", "privacy", "terms"];
const ARTICLES = ["processor-generations-explained", "how-much-ram", "choosing-storage", "business-laptop-lines"];
const UNFINISHED = /being finali[sz]ed|pending business approval|we haven[’']t published|will be published here|lorem ipsum|DRAFT · EDITORIAL REVIEW|Founding year|Business registration|prototype|not connected/i;

async function status(page: Page, path: string) {
  return (await page.goto(base + path, { waitUntil: "load" }))?.status() ?? 0;
}

for (const path of [...PAGES.map((s) => `/pages/${s}`), "/guides", ...ARTICLES.map((a) => `/guides/${a}`)]) {
  test(`content route ${path} is complete or not public`, async ({ page }) => {
    const st = await status(page, path);
    expect([200, 404], `${path} → ${st}`).toContain(st);
    const main = await page.locator("main").innerText();
    expect(main).not.toMatch(UNFINISHED);
    const robots = await page.locator('meta[name="robots"]').evaluateAll((ms) => ms.map((m) => m.getAttribute("content") || ""));
    if (st === 200) {
      await expect(page.locator("h1")).toBeVisible();
      expect(robots.some((r) => /noindex/.test(r)), robots.join(" | ")).toBe(false);
      await expect(page.locator("footer")).toBeVisible();
    } else {
      expect(robots.length > 0 && robots.every((r) => /noindex/.test(r)), robots.join(" | ")).toBe(true);
    }
  });
}

test("missing content routes 404", async ({ page }) => {
  expect(await status(page, "/pages/no-such-page")).toBe(404);
  expect(await status(page, "/guides/no-such-article")).toBe(404);
});

test("sitemap, footer and header link only public content", async ({ page, request }) => {
  const xml = await (await request.get(`${base}/sitemap.xml`)).text();
  const listed = [...xml.matchAll(/<loc>[^<]*?(\/(?:pages|guides)[^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const p of listed) expect(await status(page, p), `sitemap lists ${p}`).toBe(200);
  await page.goto(`${base}/`, { waitUntil: "load" });
  const links = await page.locator('header a[href^="/pages/"], header a[href^="/guides"], footer a[href^="/pages/"], footer a[href^="/guides"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href") || ""))]);
  for (const href of links) expect(await status(page, href), `linked ${href}`).toBe(200);
});

test("homepage inquiry: validation, failure, success (mocked)", async ({ page }) => {
  let calls = 0;
  let mode: "fail" | "ok" = "fail";
  await page.route("**/api/contact", (route) => {
    calls++;
    if (mode === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"submit_failed"}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto(`${base}/#ask`, { waitUntil: "load" });
  const form = page.getByRole("form", { name: "Send an inquiry to Laptops HUB" });
  const send = form.getByRole("button", { name: "Send my inquiry" });
  await send.click();
  await expect(form.getByText("Enter your name")).toBeVisible();
  await expect(form.getByText("Give a mobile number or an email")).toBeVisible();
  expect(calls).toBe(0);
  await form.getByLabel("Full name").fill("QA Test");
  await form.getByRole("textbox", { name: /^Mobile number/ }).fill("0300 1234567");
  await form.getByLabel("Your requirements or question").fill("Testing the inquiry form states.");
  await send.click();
  await expect(form.getByRole("alert")).toContainText("could not be saved");
  await expect(page.getByText("Your inquiry has been received.")).toHaveCount(0);
  mode = "ok";
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "Your inquiry has been received." })).toBeVisible();
  expect(calls).toBe(2);
});

test("contact page form: validation, failure, success (mocked) — when the contact page is public", async ({ page }) => {
  test.skip((await status(page, "/pages/contact")) !== 200, "contact page not published");
  let calls = 0;
  let mode: "fail" | "ok" = "fail";
  await page.route("**/api/contact", (route) => {
    calls++;
    if (mode === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"submit_failed"}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto(`${base}/pages/contact`, { waitUntil: "load" });
  const send = page.getByRole("button", { name: "Send message" });
  await send.click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("textbox", { name: "Name" }).fill("QA Test");
  await page.getByRole("textbox", { name: "Email" }).fill("qa@example.com");
  await page.getByRole("textbox", { name: "Message" }).fill("Testing the contact form states.");
  await send.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("could not be saved");
  mode = "ok";
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "Message received" })).toBeVisible();
  expect(calls).toBe(2);
});

test("contact API rejects invalid and cross-site posts without storing", async ({ request }) => {
  // 400 (validation) or 429 (the real rate limiter, which runs first) — either way nothing is stored.
  const bad = await request.post(`${base}/api/contact`, { data: { name: "x", message: "hi" } });
  expect([400, 429]).toContain(bad.status());
  const noRoute = await request.post(`${base}/api/contact`, { data: { name: "QA Test", message: "Long enough message" } });
  expect([400, 429]).toContain(noRoute.status());
  const homeBad = await request.post(`${base}/api/contact`, { data: { source: "home", name: "QA Test", phone: "03001234567", preferred: "email", message: "Long enough message" } });
  expect([400, 429]).toContain(homeBad.status());
  const cross = await request.post(`${base}/api/contact`, {
    headers: { origin: "https://evil.example" },
    data: { name: "QA Test", email: "qa@example.com", message: "Long enough message" },
  });
  expect(cross.status()).toBe(403);
});

test("help side navigation lists only public pages — when any help page is public", async ({ page }) => {
  let publicPage: string | null = null;
  for (const s of PAGES) {
    if ((await status(page, `/pages/${s}`)) === 200) {
      publicPage = s;
      break;
    }
  }
  test.skip(!publicPage, "no content page published");
  await page.goto(`${base}/pages/${publicPage}`, { waitUntil: "load" });
  const nav = page.getByRole("complementary", { name: "Page navigation" });
  await expect(nav.getByText("SOON")).toHaveCount(0);
  for (const href of await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") || ""))) {
    expect(await status(page, href), href).toBe(200);
  }
});
