/**
 * G13 (P1): product images can be added (library, upload, address), described, reordered, made primary and removed,
 * and the storefront (gallery alt, Open Graph image, Product JSON-LD) follows. Rights are owner/admin only.
 * Isolated stack only. Needs scripts/dev/isolated-cms-media-table.sql (the local stack runs without Storage, so the
 * file-store call of an upload is intercepted; everything after it is real). The product's images are restored.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const P = fx.products[1] as { handle: string; title: string };
const IMG_A = `https://cdn.shopify.com/s/files/1/qa/${RUN}-a.jpg`;
const IMG_B = `https://example.com/qa/${RUN}-b.webp`;
const LIB_URL = `https://cdn.shopify.com/s/files/1/qa/${RUN}-library.png`;
const UP_URL = `https://cdn.shopify.com/s/files/1/qa/${RUN}-upload.png`;

let productId = "";
let original: { id: string; url: string; alt: string; position: number; is_primary: boolean; approval: string }[] = [];
const assetIds: string[] = [];

async function signIn(page: Page, role: "owner" | "editor" | "fulfillment") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const rows = async () =>
  (await sb.from("product_media").select("id, url, alt, position, is_primary, approval, rights_note, origin").eq("product_id", productId).order("position")).data!;
const api = `/api/admin/products/${P.handle}/media`;

test.describe.serial("Product media (G13, isolated)", () => {
  test.beforeAll(async () => {
    const { data: p } = await sb.from("products").select("id").eq("handle", P.handle).single();
    productId = p!.id;
    original = (await sb.from("product_media").select("id, url, alt, position, is_primary, approval").eq("product_id", productId).order("position")).data!;
    const { data: lib } = await sb
      .from("cms_media_assets")
      .insert({ path: `qa/${RUN}-library.png`, public_url: LIB_URL, alt: "QA library photo of the keyboard", mime_type: "image/png", byte_size: 1234 })
      .select("id")
      .single();
    assetIds.push(lib!.id);
  });
  test.afterAll(async () => {
    await sb.from("product_variants").update({ media_id: null }).eq("product_id", productId);
    await sb.from("product_media").delete().eq("product_id", productId).not("id", "in", `(${original.map((o) => o.id).join(",") || "00000000-0000-0000-0000-000000000000"})`);
    for (const [i, o] of original.entries()) await sb.from("product_media").update({ position: 500 + i }).eq("id", o.id);
    for (const o of original) await sb.from("product_media").update({ position: o.position, alt: o.alt, is_primary: o.is_primary, approval: o.approval, rights_note: null }).eq("id", o.id);
    if (assetIds.length) await sb.from("cms_media_assets").delete().in("id", assetIds);
  });

  test("add by address (checked), from the library, and by upload", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "editor");
    await page.goto(`/admin/products/${P.handle}`);
    const box = page.getByTestId("product-media");
    await expect(box.getByTestId("product-media-item")).toHaveCount(original.length);

    // Unsafe or non-image addresses are refused with a plain message.
    const address = box.getByLabel("Image address");
    for (const [u, re] of [
      [`http://example.com/${RUN}.jpg`, /secure/],
      [`https://example.com/${RUN}.html`, /image file/],
      ["https://169.254.169.254/latest/meta-data", /public website/],
    ] as const) {
      await address.fill(u);
      await box.getByRole("button", { name: "Add image" }).click();
      await expect(box.getByTestId("product-media-error")).toHaveText(re);
    }
    for (const u of [IMG_A, IMG_B]) {
      await address.fill(u);
      await box.getByRole("button", { name: "Add image" }).click();
      await expect(box.getByTestId("product-media-msg")).toContainText("Image added");
    }
    await address.fill(IMG_A);
    await box.getByRole("button", { name: "Add image" }).click();
    await expect(box.getByTestId("product-media-error")).toHaveText("This image is already in the product's gallery.");

    // Media library (uploaded images) → attached by id; its description comes along.
    await box.getByRole("button", { name: "Show" }).click();
    await box.getByRole("button", { name: /Add QA library photo of the keyboard/ }).click();
    await expect(box.getByTestId("product-media-msg")).toContainText("Image added");
    await expect(box.getByRole("button", { name: /QA library photo.*already added/ })).toBeDisabled();

    // Upload: the browser-side checks run first; the file store itself is not available locally, so that one call is
    // answered with a real library row; attaching it is the real API.
    const { data: up } = await sb.from("cms_media_assets").insert({ path: `qa/${RUN}-upload.png`, public_url: UP_URL, alt: "", mime_type: "image/png", byte_size: 99 }).select("id").single();
    assetIds.push(up!.id);
    await box.getByLabel("Image file to upload").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await box.getByRole("button", { name: "Upload and add" }).click();
    await expect(box.getByTestId("product-media-error")).toHaveText("The image must be under 5 MB.");
    await box.getByLabel("Image file to upload").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await box.getByRole("button", { name: "Upload and add" }).click();
    await expect(box.getByTestId("product-media-error")).toHaveText("Use a JPEG, PNG, WebP or GIF image.");
    await page.route("**/api/admin/media/upload", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: up!.id, url: UP_URL }) }));
    await box.getByLabel("Image file to upload").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
    await box.getByRole("button", { name: "Upload and add" }).click();
    await expect(box.getByTestId("product-media-msg")).toContainText("Image added");
    await page.unroute("**/api/admin/media/upload");

    const r = await rows();
    expect(r.map((m) => m.url).slice(-4)).toEqual([IMG_A, IMG_B, LIB_URL, UP_URL]);
    expect(r.find((m) => m.url === LIB_URL)!.origin).toBe("uploaded");
    expect(r.find((m) => m.url === IMG_A)!.origin).toBe("source_shopify");
    expect(r.map((m) => m.position)).toEqual(r.map((_, i) => i + 1));
    await page.reload();
    await expect(box.getByTestId("product-media-item")).toHaveCount(original.length + 4);
  });

  test("describe, make primary, reorder: saved, reloaded and shown on the storefront", async ({ page, request }) => {
    test.setTimeout(150_000);
    await signIn(page, "editor");
    await page.goto(`/admin/products/${P.handle}`);
    const box = page.getByTestId("product-media");
    const item = (url: string) => box.getByTestId("product-media-item").filter({ has: page.locator(`img[src="${url}"]`) });

    const ALT = `QA ${RUN}: ThinkPad T580 seen from the left, lid open`;
    await item(IMG_B).getByLabel("Image description (alt text)").fill(ALT);
    await item(IMG_B).getByRole("button", { name: "Save description" }).click();
    await expect(box.getByTestId("product-media-msg")).toHaveText("Description saved.");

    // Make the last-but-two image primary: no position collision, exactly one primary, positions 1..n.
    await item(IMG_B).getByRole("button", { name: "Make primary" }).click();
    await expect(box.getByTestId("product-media-msg")).toContainText("Primary image set");
    await page.reload();
    await expect(box.getByTestId("product-media-item").first()).toHaveAttribute("data-media-id", (await rows())[0].id);
    await expect(item(IMG_B).getByTestId("product-media-primary")).toBeVisible();
    await expect(item(IMG_B).getByLabel("Image description (alt text)")).toHaveValue(ALT);
    let r = await rows();
    expect(r[0].url).toBe(IMG_B);
    expect(r.filter((m) => m.is_primary).map((m) => m.url)).toEqual([IMG_B]);
    expect(r.map((m) => m.position)).toEqual(r.map((_, i) => i + 1));

    // Storefront: the gallery's main image uses the saved description; share image and Product JSON-LD lead with it.
    await expect
      .poll(async () => (await (await request.get(`/products/${P.handle}`)).text()).includes(`property="og:image" content="${IMG_B}"`), { timeout: 30_000 })
      .toBe(true);
    const html = await (await request.get(`/products/${P.handle}`)).text();
    expect(html).toContain(`property="og:image:alt" content="${ALT}"`);
    // Server-rendered gallery image carries the saved description (the made-up test address cannot load in a browser).
    expect(html).toContain(`alt="${ALT}"`);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const product = ld.flatMap((x) => (Array.isArray(x["@graph"]) ? x["@graph"] : [x])).find((x) => x["@type"] === "Product");
    expect(product.image[0]).toBe(IMG_B);

    // Down then Up returns to the same order.
    const before = (await rows()).map((m) => m.id);
    await box.getByRole("button", { name: "Move image 1 down" }).click();
    await expect(box.getByTestId("product-media-msg")).toHaveText("Order saved.");
    r = await rows();
    expect(r[1].url).toBe(IMG_B);
    expect(r[0].is_primary).toBe(true);
    await box.getByRole("button", { name: "Move image 2 up" }).click();
    await expect(box.getByTestId("product-media-msg")).toHaveText("Order saved.");
    expect((await rows()).map((m) => m.id)).toEqual(before);
  });

  test("remove: refused while an option uses it; otherwise detached and the file kept", async ({ page }) => {
    await signIn(page, "editor");
    const target = (await rows()).find((m) => m.url === LIB_URL)!;
    const { data: v } = await sb.from("product_variants").select("id, title").eq("product_id", productId).limit(1).single();
    await sb.from("product_variants").update({ media_id: target.id }).eq("id", v!.id);

    await page.goto(`/admin/products/${P.handle}`);
    const box = page.getByTestId("product-media");
    const item = box.getByTestId("product-media-item").filter({ has: page.locator(`img[src="${LIB_URL}"]`) });
    page.on("dialog", (d) => void d.accept());
    await item.getByRole("button", { name: /^Remove image/ }).click();
    await expect(box.getByTestId("product-media-error")).toContainText("is the picture for the option");
    expect((await rows()).some((m) => m.id === target.id)).toBe(true);

    await sb.from("product_variants").update({ media_id: null }).eq("id", v!.id);
    await item.getByRole("button", { name: /^Remove image/ }).click();
    await expect(box.getByTestId("product-media-msg")).toHaveText("Image removed from this product. The file itself was not deleted.");
    const r = await rows();
    expect(r.some((m) => m.id === target.id)).toBe(false);
    expect(r.map((m) => m.position)).toEqual(r.map((_, i) => i + 1));
    expect((await sb.from("cms_media_assets").select("id").eq("id", assetIds[0])).data).toHaveLength(1);
  });

  test("rights: owner records them; editors and fulfillment cannot; stale order refused", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto(`/admin/products/${P.handle}`);
    await expect(page.getByTestId("product-media").getByLabel("Image rights")).toHaveCount(0);
    const target = (await rows()).find((m) => m.url === IMG_A)!;
    const denied = await page.request.patch(api, { data: { mediaId: target.id, rights: "approved" } });
    expect(denied.status()).toBe(403);
    const stale = await page.request.patch(api, { data: { orderedIds: (await rows()).map((m) => m.id).slice(1) } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toBe("stale_order");

    await page.context().clearCookies();
    await signIn(page, "owner");
    await page.goto(`/admin/products/${P.handle}`);
    const item = page.getByTestId("product-media-item").filter({ has: page.locator(`img[src="${IMG_A}"]`) });
    await item.getByLabel("Image rights").selectOption("approved");
    await item.getByLabel("Rights note").fill(`QA ${RUN} own photo`);
    await item.getByRole("button", { name: "Save rights" }).click();
    await expect(page.getByTestId("product-media-msg")).toHaveText("Rights marked as confirmed.");
    await page.reload();
    await expect(item.getByTestId("product-media-rights")).toHaveText("Rights confirmed");
    expect((await rows()).find((m) => m.id === target.id)).toMatchObject({ approval: "approved", rights_note: `QA ${RUN} own photo` });

    await page.context().clearCookies();
    await signIn(page, "fulfillment");
    expect((await page.request.post(api, { data: { url: `https://cdn.shopify.com/s/files/1/qa/${RUN}-z.jpg` } })).status()).toBe(403);
  });
});
