/**
 * G47 on the ISOLATED stack: every admin write API refuses a cross-site request before route code runs, even with a
 * valid owner session. Same-site requests still reach the route (a deliberately invalid body gets the route's own 400),
 * reads are unaffected, and no stored setting changes.
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const EVIL = "https://evil.example";

// Routes that had no cross-site check of their own before G47 (one per area), plus one that did.
const WRITES: { method: "post" | "put" | "patch" | "delete"; path: string }[] = [
  { method: "put", path: "/api/admin/notifications/settings" },
  { method: "post", path: "/api/admin/posts" },
  { method: "put", path: "/api/admin/navigation" },
  { method: "post", path: "/api/admin/reels" },
  { method: "put", path: "/api/admin/theme/homepage" },
  { method: "put", path: "/api/admin/store-settings" },
  { method: "post", path: "/api/admin/discounts" },
  { method: "post", path: "/api/admin/backups" },
  { method: "post", path: "/api/admin/staff" },
];

test("G47: cross-site admin writes are refused for a signed-in owner; same-site still reaches the route", async ({ page }) => {
  test.setTimeout(90_000);
  await assertLocalOnly("admin cross-site");
  const settingsBefore = (await sb.from("store_settings").select("key, value").order("key")).data;
  const backupsBefore = (await sb.from("merchant_snapshots").select("id", { count: "exact", head: true })).count;

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);

  for (const w of WRITES) {
    const r = await page.request[w.method](w.path, { headers: { origin: EVIL }, data: { label: "QA cross-site" } });
    expect(r.status(), `${w.method.toUpperCase()} ${w.path}`).toBe(403);
    expect((await r.json()).error, w.path).toBe("forbidden_origin");
  }

  // Same site with an invalid body: the route itself answers (validation), proving the check is origin-specific.
  const same = await page.request.put("/api/admin/notifications/settings", { headers: { origin: ORIGIN }, data: { recipients: ["not-an-email"] } });
  expect(same.status()).toBe(400);
  // Reads are not affected by the origin check.
  const read = await page.request.get("/api/admin/notifications/settings", { headers: { origin: EVIL } });
  expect(read.status()).toBe(200);
  // Anonymous cross-site is refused the same way (before the session is read).
  const anon = await page.context().browser()!.newContext();
  const a = await anon.request.post(new URL("/api/admin/posts", ORIGIN).toString(), { headers: { origin: EVIL }, data: {} });
  expect(a.status()).toBe(403);
  await anon.close();

  expect((await sb.from("store_settings").select("key, value").order("key")).data).toEqual(settingsBefore);
  expect((await sb.from("merchant_snapshots").select("id", { count: "exact", head: true })).count).toBe(backupsBefore);
});
