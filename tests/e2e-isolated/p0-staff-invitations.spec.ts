/**
 * Staff accounts on the ISOLATED stack (local Supabase, app on :3001, fake Resend on :4599):
 *  - owner invites an admin and a fulfillment person from Admin → Staff; the email link sets a password; each signs in
 *    with their own account and gets exactly their role
 *  - admin cannot grant admin, cannot change the owner or another admin, cannot change themselves
 *  - manager / editor / fulfillment cannot open Staff or call its API; anonymous is refused
 *  - deactivation ends access immediately (open session refused, sign-in refused); reactivation restores it
 *  - every change is audited
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("staff journeys need a local Supabase");
const FAKE = process.env.FAKE_RESEND_URL || "http://127.0.0.1:4599";
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const TAG = Date.now().toString(36);
const ADMIN_EMAIL = `qa-admin-${TAG}@lh-test.local`;
const FUL_EMAIL = `qa-ful-${TAG}@lh-test.local`;
const PASS = `Staff-${randomUUID().slice(0, 8)}-Key!`;
const ids: Record<string, string> = {};

type Mail = { to: string[]; subject: string; text: string };
const inviteLink = async (to: string) => {
  for (let i = 0; i < 30; i++) {
    const log = (await (await fetch(`${FAKE}/_log`)).json()) as { delivered: Mail[] };
    const m = [...log.delivered].reverse().find((d) => d.to.includes(to));
    if (m) return m.text.match(/https?:\/\/\S+token_hash=\S+/)![0];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no invitation email for ${to}`);
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
const api = (page: Page, method: "post" | "patch" | "get", path: string, data?: unknown) =>
  page.request[method](path, { headers: { origin: "http://127.0.0.1:3001" }, data });

async function acceptInvite(page: Page, email: string) {
  await page.goto(await inviteLink(email));
  await expect(page).toHaveURL(/\/admin\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill(PASS);
  await page.getByLabel("Repeat new password").fill(PASS);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/admin\/login\?reset=1/, { timeout: 15_000 });
  await signIn(page, email, PASS);
  await page.waitForURL(/\/admin$/);
}

test.describe.serial("P0: staff invitations, roles and deactivation (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("staff invitations");
    // Invitations are limited to 10 per inviter per hour (src/app/api/admin/staff/route.ts); start every run from a
    // fresh quota ("*" is PostgREST's LIKE wildcard) and prove the reset worked.
    const { error } = await sb.from("rate_limit_buckets").delete().like("bucket_key", "staff-invite:*");
    expect(error).toBeNull();
    const { count } = await sb.from("rate_limit_buckets").select("bucket_key", { count: "exact", head: true }).like("bucket_key", "staff-invite:*");
    expect(count).toBe(0);
  });

  test.afterAll(async () => {
    for (const id of Object.values(ids)) await sb.auth.admin.deleteUser(id); // cascades the memberships
  });

  test("owner invites an admin and a fulfillment person; each sets a password and gets exactly that role", async ({ page, browser }) => {
    await signIn(page, fx.staff.owner.email, fx.staff.owner.password);
    await page.waitForURL(/\/admin$/);
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Staff", level: 1 })).toBeVisible();
    // The owner row is not editable by anyone, including the owner.
    await expect(page.locator(`[data-testid=staff-row][data-email="${fx.staff.owner.email}"]`).getByRole("button")).toHaveCount(0);

    for (const [email, role] of [[ADMIN_EMAIL, "admin"], [FUL_EMAIL, "fulfillment"]] as const) {
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Role", { exact: true }).selectOption(role);
      await page.getByRole("button", { name: "Send invitation", exact: true }).click();
      await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
      const row = page.locator(`[data-testid=staff-row][data-email="${email}"]`);
      await expect(row).toContainText("Invited — not signed in yet");
      const { data: u } = await sb.from("admin_memberships").select("user_id, role, is_active, created_by").eq("role", role).order("created_at", { ascending: false }).limit(1).single();
      expect(u).toMatchObject({ role, is_active: true, created_by: fx.staff.owner.id });
      ids[role] = u!.user_id;
    }
    // Both invitations are stored and listed after a full reload (server data, not client state).
    await page.reload();
    for (const email of [ADMIN_EMAIL, FUL_EMAIL]) {
      await expect(page.locator(`[data-testid=staff-row][data-email="${email}"]`)).toContainText("Invited — not signed in yet");
    }
    const { count: members } = await sb.from("admin_memberships").select("user_id", { count: "exact", head: true });
    await expect(page.getByTestId("staff-row")).toHaveCount(members!);
    // Duplicate invitation refused.
    const dup = await api(page, "post", "/api/admin/staff", { email: FUL_EMAIL, role: "editor" });
    expect(dup.status()).toBe(409);

    for (const [email, role] of [[ADMIN_EMAIL, "admin"], [FUL_EMAIL, "fulfillment"]] as const) {
      const ctx = await (browser as Browser).newContext();
      const p = await ctx.newPage();
      await acceptInvite(p, email);
      await expect(p.getByText(new RegExp(`role\\s*${role}`, "i")).first()).toBeVisible();
      await ctx.close();
    }
    const { count } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "staff.invite").in("entity_id", [ids.admin, ids.fulfillment]);
    expect(count).toBe(2);
  });

  test("invitation failures are shown to the owner and change nothing", async ({ page }) => {
    await signIn(page, fx.staff.owner.email, fx.staff.owner.password);
    await page.waitForURL(/\/admin$/);
    await page.goto("/admin/staff");
    const rows = page.getByTestId("staff-row");
    const before = await rows.count();
    const membersBefore = (await sb.from("admin_memberships").select("user_id", { count: "exact", head: true })).count;
    const invite = async (email: string, role: string) => {
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Role", { exact: true }).selectOption(role);
      await page.getByRole("button", { name: "Send invitation", exact: true }).click();
    };

    // Already staff → refused with an explanation; role unchanged.
    await invite(ADMIN_EMAIL, "editor");
    await expect(page.getByRole("alert").filter({ hasText: "This person already has admin access. Change their role in the list instead." })).toHaveText("This person already has admin access. Change their role in the list instead.");
    expect((await sb.from("admin_memberships").select("role").eq("user_id", ids.admin).single()).data!.role).toBe("admin");

    // Malformed email → 400 from the API (the form's email field also blocks it in the browser).
    const bad = await api(page, "post", "/api/admin/staff", { email: "not-an-email", role: "editor" });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toBe("validation_failed");

    // Hourly quota used up → 429 with a message; no Auth user, membership or email is created.
    const LIMITED = `qa-limited-${TAG}@lh-test.local`;
    await sb.from("rate_limit_buckets").upsert({ bucket_key: `staff-invite:${fx.staff.owner.id}`, count: 10, window_starts_at: new Date().toISOString() });
    await invite(LIMITED, "editor");
    await expect(page.getByRole("alert").filter({ hasText: "Too many invitations. Try again later." })).toHaveText("Too many invitations. Try again later.");
    await sb.from("rate_limit_buckets").delete().eq("bucket_key", `staff-invite:${fx.staff.owner.id}`);
    const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
    expect(users.users.some((u) => u.email === LIMITED)).toBe(false);
    const mails = ((await (await fetch(`${FAKE}/_log`)).json()) as { delivered: Mail[] }).delivered;
    expect(mails.some((m) => m.to.includes(LIMITED))).toBe(false);

    await page.reload();
    await expect(rows).toHaveCount(before);
    expect((await sb.from("admin_memberships").select("user_id", { count: "exact", head: true })).count).toBe(membersBefore);
  });

  test("an address typed before the page has hydrated is kept and can be sent", async ({ page }) => {
    await signIn(page, fx.staff.owner.email, fx.staff.owner.password);
    await page.waitForURL(/\/admin$/);
    // Slow script delivery: the server-rendered form is usable for typing before React hydrates it.
    await page.route(/\/_next\/static\/chunks\//, async (r) => {
      await new Promise((x) => setTimeout(x, 2_000));
      await r.continue();
    });
    await page.goto("/admin/staff", { waitUntil: "commit" });
    const field = page.getByLabel("Email address");
    await field.fill(`qa-early-${TAG}@lh-test.local`);
    // Before the fix the address stayed visible while the button stayed disabled for good.
    await expect(page.getByRole("button", { name: "Send invitation", exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(field).toHaveValue(`qa-early-${TAG}@lh-test.local`);
    await page.unroute(/\/_next\/static\/chunks\//);
  });

  test("admin limits: cannot grant admin, cannot touch owner, self or another admin", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, PASS);
    await page.waitForURL(/\/admin$/);
    await page.goto("/admin/staff");
    await expect(page.getByLabel("Role", { exact: true }).locator("option")).toHaveText(["Manager", "Editor", "Fulfillment"]);
    expect((await api(page, "post", "/api/admin/staff", { email: `qa-x-${TAG}@lh-test.local`, role: "admin" })).status()).toBe(403);
    expect((await api(page, "patch", `/api/admin/staff/${fx.staff.owner.id}`, { action: "deactivate" })).status()).toBe(403);
    expect((await api(page, "patch", `/api/admin/staff/${ids.admin}`, { action: "role", role: "manager" })).status()).toBe(403);
    // An admin may manage non-admin staff.
    const r = await api(page, "patch", `/api/admin/staff/${ids.fulfillment}`, { action: "role", role: "editor" });
    expect(r.status()).toBe(200);
    expect((await sb.from("admin_memberships").select("role").eq("user_id", ids.fulfillment).single()).data!.role).toBe("editor");
    expect((await api(page, "patch", `/api/admin/staff/${ids.fulfillment}`, { action: "role", role: "fulfillment" })).status()).toBe(200);
  });

  for (const role of ["manager", "editor", "fulfillment"] as const) {
    test(`${role}: Staff page and API refused`, async ({ page }) => {
      await signIn(page, fx.staff[role].email, fx.staff[role].password);
      await page.waitForURL(/\/admin$/);
      await page.goto("/admin/staff");
      await expect(page).toHaveURL(/\/admin\/forbidden/);
      expect((await api(page, "get", "/api/admin/staff")).status()).toBe(403);
      expect((await api(page, "post", "/api/admin/staff", { email: `qa-y-${TAG}@lh-test.local`, role: "editor" })).status()).toBe(403);
      expect((await api(page, "patch", `/api/admin/staff/${ids.fulfillment}`, { action: "deactivate" })).status()).toBe(403);
    });
  }

  test("anonymous: refused", async ({ request }) => {
    expect((await request.get("/api/admin/staff")).status()).toBe(401);
    expect((await request.post("/api/admin/staff", { headers: { origin: "http://127.0.0.1:3001" }, data: { email: "a@b.pk", role: "editor" } })).status()).toBe(401);
  });

  test("deactivation ends access at once; reactivation restores it", async ({ page, browser }) => {
    // The fulfillment person is signed in on another device.
    const ctx = await (browser as Browser).newContext();
    const theirs = await ctx.newPage();
    await signIn(theirs, FUL_EMAIL, PASS);
    await theirs.waitForURL(/\/admin$/);

    await signIn(page, fx.staff.owner.email, fx.staff.owner.password);
    await page.waitForURL(/\/admin$/);
    await page.goto("/admin/staff");
    page.once("dialog", (d) => d.accept());
    const row = page.locator(`[data-testid=staff-row][data-email="${FUL_EMAIL}"]`);
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Deactivated", { timeout: 15_000 }); // Auth ban + page refresh

    // Their open session is refused on the next request, and they cannot sign in again.
    await theirs.goto("/admin/orders");
    await expect(theirs).toHaveURL(/\/admin\/(login|forbidden)/);
    await theirs.goto("/admin");
    await expect(theirs).toHaveURL(/\/admin\/(login|forbidden)/);
    await signIn(theirs, FUL_EMAIL, PASS);
    await expect(theirs).toHaveURL(/\/admin\/login/);
    await ctx.close();

    await row.getByRole("button", { name: "Reactivate" }).click();
    await expect(row).toContainText("Active", { timeout: 15_000 });
    const again = await (browser as Browser).newContext();
    const p2 = await again.newPage();
    await signIn(p2, FUL_EMAIL, PASS);
    await p2.waitForURL(/\/admin$/);
    await again.close();

    const { data: audit } = await sb.from("audit_logs").select("action").eq("entity_id", ids.fulfillment).order("created_at");
    expect(audit!.map((a) => a.action)).toEqual(expect.arrayContaining(["staff.invite", "staff.role_change", "staff.deactivate", "staff.activate"]));
  });
});
