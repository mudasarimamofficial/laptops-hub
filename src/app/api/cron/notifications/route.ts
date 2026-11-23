import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { publicWriteBlockedResponse } from "@/lib/security/public-write-guard";
import { processOutbox, RETRIES_STOPPED } from "@/lib/notify/outbox";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safety-net delivery of pending/failed notifications (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * Also performs a lightweight Supabase keepalive touch so Free-plan projects get daily independent DB activity
 * without relying solely on GitHub Actions schedules (which can disable on inactive public repos).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  const blocked = publicWriteBlockedResponse();
  if (blocked) return blocked;
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = createServiceClient();
  const result = await processOutbox({ limit: 25 });
  // Rows that no automatic retry will touch again: they need a staff decision (order page → Retry sending).
  const { count, error } = await sb
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .like("last_error", `%${RETRIES_STOPPED}`);
  if (error) throw new Error(`needs-attention count failed: ${error.message}`);

  let keepalive: { ok: boolean; mode?: string; error?: string; ping_count?: number } = { ok: false };
  const { data: touched, error: touchErr } = await sb.rpc("touch_keepalive", { p_source: "vercel-notifications-cron" });
  if (!touchErr && touched) {
    keepalive = { ok: true, mode: "touch_keepalive", ...(touched as object) };
  } else {
    const { error: readErr } = await sb.from("store_settings").select("key").limit(1);
    keepalive = readErr
      ? { ok: false, error: readErr.message, mode: "store_settings_read" }
      : { ok: true, mode: "store_settings_read", error: touchErr?.message };
  }

  return NextResponse.json(
    { ...result, needsAttention: count ?? 0, keepalive },
    { headers: { "Cache-Control": "no-store" } },
  );
}
