/**
 * G12 (P1): a merchant collection is either hand-picked (in the merchant's order) or chosen by rules, and the admin page
 * and the storefront always agree which. Saving rules switches the type; clearing them brings the picks back in order.
 * Reorder/remove failures are shown to the merchant. Isolated stack only; the QA collection is deleted afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const SLUG = `qa-g12-${RUN}`;
const [DELL, LENOVO] = fx.products as { handle: string; title: string }[];

async function signIn(page: Page, role: "owner" | "editor" | "fulfillment") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
/** Product handles in the order the storefront collection grid shows them (grid cards only, in a real browser tab). */
async function storefrontOrder(page: Page) {
  const tab = await page.context().newPage();
  try {
    await tab.goto(`/collections/${SLUG}`);
    const hrefs = await tab.locator('.v5-card-grid a[href^="/products/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href") || ""));
    return [...new Set(hrefs.map((h) => decodeURIComponent(h.replace("/products/", "").split(/[?#]/)[0])))];
  } finally {
    await tab.close();
  }
}
const ids: Record<string, string> = {};
async function picks() {
  const { data: c } = await sb.from("collections").select("id").eq("slug", SLUG).single();
  return (await sb.from("collection_products").select("product_id, position").eq("collection_id", c!.id).order("position")).data!;
}

test.describe.serial("Collection modes and order (G12, isolated)", () => {
  test.beforeAll(async () => {
    for (const p of [DELL, LENOVO]) {
      const { data } = await sb.from("products").select("id").eq("handle", p.handle).single();
      ids[p.handle] = data!.id;
    }
  });
  test.afterAll(async () => {
    const { data: c } = await sb.from("collections").select("id").eq("slug", SLUG).maybeSingle();
    if (c) {
      await sb.from("collection_products").delete().eq("collection_id", c.id);
      await sb.from("collections").delete().eq("id", c.id);
    }
  });

  test("hand-picked order: reorder in admin → survives reload → storefront shows that order", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "owner");
    const created = await page.request.post("/api/admin/collections", {
      data: { title: `QA G12 ${RUN}`, slug: SLUG, published: true, collectionType: "manual" },
    });
    expect(created.status(), await created.text()).toBeLessThan(300);
    for (const p of [DELL, LENOVO]) {
      const r = await page.request.patch(`/api/admin/collections/${SLUG}`, { data: { addProductIds: [ids[p.handle]] } });
      expect(r.status(), await r.text()).toBe(200);
    }

    await page.goto(`/admin/collections/${SLUG}`);
    await expect(page.getByTestId("collection-mode")).toHaveAttribute("data-mode", "manual");
    await expect(page.getByTestId("collection-preview")).toContainText("shows 2 products");
    const members = page.getByTestId("collection-member");
    await expect(members.first()).toContainText(DELL.title);
    await expect.poll(() => storefrontOrder(page), { timeout: 20_000 }).toEqual([DELL.handle, LENOVO.handle]);

    // Lenovo first. The default "Featured" sort must keep the merchant's order, not the catalog's.
    await page.getByRole("button", { name: `Move ${LENOVO.title} up` }).click();
    await expect(page.getByTestId("collection-membership-msg")).toHaveText("Order saved.");
    await page.reload();
    await expect(members.first()).toContainText(LENOVO.title);
    await expect.poll(() => storefrontOrder(page), { timeout: 20_000 }).toEqual([LENOVO.handle, DELL.handle]);
    // The explicit sorts still work on a hand-picked collection.
    const sorted = await (await page.request.get(`/collections/${SLUG}?sort=price-asc`)).text();
    expect(sorted).toContain(`/products/${DELL.handle}`);
  });

  test("a stale or invalid reorder is refused and nothing changes", async ({ page }) => {
    await signIn(page, "owner");
    const before = await picks();
    for (const ordered of [[ids[DELL.handle]], [ids[DELL.handle], ids[DELL.handle]], [ids[DELL.handle], "00000000-0000-4000-8000-000000000000"]]) {
      const r = await page.request.patch(`/api/admin/collections/${SLUG}`, { data: { orderedProductIds: ordered } });
      expect(r.status(), JSON.stringify(ordered)).toBe(409);
      expect((await r.json()).error).toBe("stale_order");
    }
    const after = await picks();
    expect(after).toEqual(before);
  });

  test("reorder and remove failures are shown, and the list is not changed", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto(`/admin/collections/${SLUG}`);
    const members = page.getByTestId("collection-member");
    await expect(members.first()).toContainText(LENOVO.title);

    await page.route(`**/api/admin/collections/${SLUG}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "save_failed", message: "QA: could not save the new order." }) })
        : route.continue(),
    );
    await page.getByRole("button", { name: `Move ${DELL.title} up` }).click();
    await expect(page.getByTestId("collection-membership").getByRole("alert")).toHaveText("QA: could not save the new order.");
    await expect(members.first()).toContainText(LENOVO.title);

    await page.getByRole("button", { name: `Remove ${DELL.title} from the collection` }).click();
    await expect(page.getByTestId("collection-membership").getByRole("alert")).toHaveText("QA: could not save the new order.");
    await expect(members).toHaveCount(2);
    await page.unroute(`**/api/admin/collections/${SLUG}`);
  });

  test("rules switch the collection to automatic; clearing them brings the picks back in order", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "editor");
    await page.goto(`/admin/collections/${SLUG}`);
    const rules = page.getByTestId("collection-rules");

    // Blank value: refused in the browser with a plain message, nothing saved.
    await rules.getByLabel("Condition 1: value").fill("   ");
    await rules.getByRole("button", { name: "Save rules" }).click();
    await expect(rules.getByRole("alert")).toHaveText("Condition 1: enter a value.");
    expect((await sb.from("collections").select("collection_type").eq("slug", SLUG).single()).data!.collection_type).toBe("manual");

    // Brand is Lenovo → automatic; the picks are kept but not used.
    await rules.getByLabel("Condition 1: field").selectOption("title");
    await rules.getByLabel("Condition 1: comparison").selectOption("contains");
    await rules.getByLabel("Condition 1: value").fill("ThinkPad");
    await rules.getByRole("button", { name: "Save rules" }).click();
    await expect(rules.getByTestId("collection-rules-saved")).toBeVisible();
    await expect(page.getByTestId("collection-mode")).toHaveAttribute("data-mode", "automated");
    await expect(page.getByTestId("collection-picks-kept")).toContainText("2 hand-picked products are kept");
    await expect(page.getByTestId("collection-membership")).toHaveCount(0);
    expect((await sb.from("collections").select("collection_type").eq("slug", SLUG).single()).data!.collection_type).toBe("automated");
    await expect.poll(() => storefrontOrder(page), { timeout: 20_000 }).toEqual([LENOVO.handle]);

    await page.reload();
    await expect(rules.getByLabel("Condition 1: value")).toHaveValue("ThinkPad");

    page.once("dialog", (d) => void d.accept());
    await rules.getByRole("button", { name: "Clear rules" }).click();
    await expect(rules.getByTestId("collection-rules-saved")).toContainText("hand-picked");
    await expect(page.getByTestId("collection-mode")).toHaveAttribute("data-mode", "manual");
    expect((await sb.from("collections").select("collection_type").eq("slug", SLUG).single()).data!.collection_type).toBe("manual");
    await expect.poll(() => storefrontOrder(page), { timeout: 20_000 }).toEqual([LENOVO.handle, DELL.handle]);
  });

  test("server validation and permissions", async ({ page }) => {
    await signIn(page, "owner");
    for (const rule of [{ match: "all", conditions: [] }, { match: "all", conditions: [{ field: "price_pkr", op: "gte", value: "cheap" }] }, { conditions: [{ field: "x", op: "drop" }] }]) {
      const r = await page.request.patch(`/api/admin/collections/${SLUG}`, { data: { rule } });
      expect(r.status(), JSON.stringify(rule)).toBe(400);
      expect((await r.json()).error).toBe("invalid_rule");
    }
    expect((await sb.from("collections").select("collection_type").eq("slug", SLUG).single()).data!.collection_type).toBe("manual");

    // Canonical stays the bare collection address; a filtered view is not indexed.
    const html = await (await page.request.get(`/collections/${SLUG}`)).text();
    expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/collections/${SLUG}"`));
    expect(await (await page.request.get(`/collections/${SLUG}?sort=price-asc`)).text()).toMatch(/<meta name="robots" content="noindex/);

    await page.context().clearCookies();
    await signIn(page, "fulfillment");
    const denied = await page.request.patch(`/api/admin/collections/${SLUG}`, { data: { orderedProductIds: [ids[DELL.handle], ids[LENOVO.handle]] } });
    expect(denied.status()).toBe(403);
    expect((await picks()).map((r) => r.product_id)).toEqual([ids[LENOVO.handle], ids[DELL.handle]]);
  });
});
