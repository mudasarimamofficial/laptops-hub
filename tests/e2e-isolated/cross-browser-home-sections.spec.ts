/**
 * Cross-browser (Chromium, WebKit, Firefox; desktop + phone) check of the homepage reviews carousel and the store map
 * reveal on the ISOLATED stack. QA entries are published through the real admin API (so the cache refreshes) and hidden
 * + deleted afterwards.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const service = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PREFIX = "QA XB";

async function ownerToken() {
  const anon = createClient(SB_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: fx.staff.owner.email, password: fx.staff.owner.password });
  if (error || !data.session) throw error ?? new Error("owner sign-in failed");
  return data.session.access_token;
}
async function hideAndDelete(request: APIRequestContext, token: string) {
  const { data } = await service.from("store_testimonials").select("id, status").like("author_name", `${PREFIX}%`);
  for (const r of data ?? []) {
    if (r.status === "published") {
      await request.patch(`/api/admin/testimonials/${r.id}`, { headers: { authorization: `Bearer ${token}` }, data: { status: "hidden" } });
    }
  }
  await service.from("store_testimonials").delete().like("author_name", `${PREFIX}%`);
}

test.describe.serial("Homepage reviews + map across browsers (isolated)", () => {
  let token = "";
  test.beforeAll(async ({ request }) => {
    await assertLocalOnly("cross-browser home sections");
    token = await ownerToken();
    await hideAndDelete(request, token);
    for (let i = 0; i < 8; i++) {
      const r = await request.post("/api/admin/testimonials", {
        headers: { authorization: `Bearer ${token}` },
        data: {
          status: "published",
          data: {
            authorName: `${PREFIX} ${i}`,
            body: `Cross-browser QA entry number ${i}; removed after the run.`,
            source: "merchant",
            consentConfirmed: true,
            rating: i % 2 ? null : 5,
          },
        },
      });
      expect(r.status(), await r.text()).toBe(201);
    }
  });
  test.afterAll(async ({ request }) => hideAndDelete(request, token));

  test("reviews carousel and map reveal render and behave", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const section = page.getByTestId("store-reviews");
    await expect(section).toBeVisible();
    expect(await section.getByTestId("store-review").count()).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const pause = page.getByTestId("store-reviews-pause");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    expect(await section.locator("[data-dir]").first().evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("paused");
    await page.getByTestId("store-reviews-all").click();
    await expect(page.getByTestId("store-reviews-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("store-reviews-dialog")).toBeHidden();

    const map = page.getByTestId("store-map");
    expect(await map.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByTestId("store-map-iframe")).toHaveCount(1);
    await expect(page.getByTestId("store-map-open")).toBeVisible();
    // At the very bottom nothing covers the map's open-in-Maps button.
    const covered = await page.getByTestId("store-map-open").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(hit && (hit === el || el.contains(hit)));
    });
    expect(covered).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
