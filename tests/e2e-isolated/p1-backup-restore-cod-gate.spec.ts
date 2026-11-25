/**
 * G17: restoring a CMS backup never changes the COD go-live gate (`store_settings.cod_checkout`), while the rest of the
 * snapshot is restored as before. Isolated stack only; backups created here and the gate value are cleaned up.
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
const RUN = Date.now().toString(36);

const setting = async (key: string) => (await sb.from("store_settings").select("value").eq("key", key).single()).data!.value as Record<string, unknown>;

test("restore keeps the live COD gate; other settings come back from the backup", async ({ page }) => {
  await assertLocalOnly("backup restore journey");
  const gateBefore = await setting("cod_checkout");
  const seoBefore = await setting("seo_defaults").catch(() => null);
  const created: string[] = [];
  try {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);

    const mk = await page.request.post("/api/admin/backups", { headers: { origin: ORIGIN }, data: { label: `QA G17 ${RUN}` } });
    expect(mk.status(), await mk.text()).toBe(200);
    const backupId = (await mk.json()).backup.id as string;
    created.push(backupId);

    // After the backup: flip the gate and change an ordinary setting.
    await sb.from("store_settings").update({ value: { ...gateBefore, enabled: !gateBefore.enabled } }).eq("key", "cod_checkout");
    await sb.from("store_settings").upsert({ key: "seo_defaults", value: { ...(seoBefore || {}), title_suffix: `QA ${RUN}` } }, { onConflict: "key" });

    const rs = await page.request.post(`/api/admin/backups/${backupId}/restore`, { headers: { origin: ORIGIN } });
    const body = await rs.json();
    expect(rs.status(), JSON.stringify(body)).toBe(200);
    if (body.checkpointId) created.push(body.checkpointId);
    expect(body.keptLive).toEqual(["cod_checkout"]);

    expect((await setting("cod_checkout")).enabled).toBe(!gateBefore.enabled); // live value kept
    expect((await setting("seo_defaults")).title_suffix ?? null).toBe((seoBefore?.title_suffix as string | undefined) ?? null); // restored
  } finally {
    await sb.from("store_settings").update({ value: gateBefore }).eq("key", "cod_checkout");
    if (seoBefore) await sb.from("store_settings").update({ value: seoBefore }).eq("key", "seo_defaults");
    if (created.length) await sb.from("merchant_snapshots").delete().in("id", created);
  }
});
