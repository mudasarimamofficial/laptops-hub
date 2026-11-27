/**
 * Activity log search on the ISOLATED stack: owners can find an entry by plain-language label, technical action,
 * record id or staff member, combine filters, clear them, and see staff emails instead of ids. Odd search text
 * (commas, brackets, quotes) never breaks the page. Editors are still refused. Rows written here are removed after.
 */
import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = `actsearch-${Date.now().toString(36)}`;

async function as(browser: Browser, role: "owner" | "editor") {
  const ctx = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
  return { ctx, page };
}

test.beforeAll(async () => {
  await assertLocalOnly("activity search");
  const { error } = await sb.from("audit_logs").insert([
    { action: "navigation.update", entity_type: "store_settings", entity_id: `${RUN}-nav`, actor_user_id: fx.staff.editor.id },
    { action: "discount.update", entity_type: "discount", entity_id: `${RUN}-disc`, actor_user_id: fx.staff.owner.id },
  ]);
  if (error) throw error;
});

test.afterAll(async () => {
  await sb.from("audit_logs").delete().like("entity_id", `${RUN}%`);
});

test("owner finds entries by record id, label, action and staff; filters combine and clear", async ({ browser }) => {
  const { ctx, page } = await as(browser, "owner");
  const rows = page.getByTestId("activity-row");

  // Record id: both entries of this run, with labels and staff emails (not uuids).
  await page.goto(`/admin/activity?q=${RUN}`);
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Saved navigation" })).toContainText(fx.staff.editor.email);
  await expect(rows.filter({ hasText: "Edited discount" })).toContainText(fx.staff.owner.email);
  await expect(page.getByTestId("activity-count")).toContainText("2 entries match these filters");

  // The form: plain-language label search through the UI, combined with a staff filter.
  await page.goto("/admin/activity");
  await page.getByLabel("Search").fill("saved navigation");
  await page.getByLabel("Staff member").selectOption({ label: fx.staff.editor.email });
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/q=saved\+navigation/);
  await expect(rows.filter({ hasText: `${RUN}-nav`.slice(0, 8) }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "Edited discount" })).toHaveCount(0);
  for (const r of await rows.all()) await expect(r).toContainText(fx.staff.editor.email);

  // Technical action name + period still finds the fresh row; another staff member's filter excludes it.
  await page.goto(`/admin/activity?q=discount.update&days=1`);
  await expect(rows.filter({ hasText: fx.staff.owner.email }).first()).toBeVisible();
  await page.goto(`/admin/activity?q=${RUN}&staff=${fx.staff.editor.id}`);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Saved navigation");

  // Clear returns the unfiltered log.
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/admin\/activity$/);
  await expect(page.getByLabel("Search")).toHaveValue("");

  // Hostile text is neutralised, never a server error; a bogus staff id is ignored rather than trusted.
  for (const q of ["a,b)", "x\"or(1", "%_*:."]) {
    const res = await page.goto(`/admin/activity?q=${encodeURIComponent(q)}&staff=not-a-user`);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("activity-count")).not.toContainText("could not be searched");
  }
  await page.goto(`/admin/activity?q=zz-no-such-${RUN}`);
  await expect(page.getByText("No activity matches these filters")).toBeVisible();
  await ctx.close();
});

test("editor is still refused the activity log", async ({ browser }) => {
  const { ctx, page } = await as(browser, "editor");
  await page.goto(`/admin/activity?q=${RUN}`);
  await expect(page).not.toHaveURL(/\/admin\/activity/);
  await expect(page.getByTestId("activity-row")).toHaveCount(0);
  await ctx.close();
});
