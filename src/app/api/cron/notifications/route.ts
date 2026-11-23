import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { publicWriteBlockedResponse } from "@/lib/security/public-write-guard";
import { processOutbox, RETRIES_STOPPED } from "@/lib/notify/outbox";
import { createServiceClient } from "@/lib/supabase/server";
import { runNotificationsCron, type KeepaliveResult } from "@/lib/cron/notifications-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function touchKeepaliveIndependent(): Promise<KeepaliveResult> {
  const sb = createServiceClient();
  try {
    const { data: touched, error: touchErr } = await sb.rpc("touch_keepalive", {
      p_source: "vercel-notifications-cron",
    });
    if (!touchErr && touched) {
      return { ok: true, mode: "touch_keepalive", ...(touched as object) };
    }
    const { error: readErr } = await sb.from("store_settings").select("key").limit(1);
    return readErr
      ? { ok: false, error: readErr.message, mode: "store_settings_read" }
      : { ok: true, mode: "store_settings_read", error: touchErr?.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "keepalive_threw" };
  }
}

/**
 * Safety-net delivery of pending/failed notifications (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * Keepalive runs independently of outbox processing so a notification failure cannot skip DB activity.
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

  const { status, body } = await runNotificationsCron({
    touchKeepalive: touchKeepaliveIndependent,
    processOutbox: () => processOutbox({ limit: 25 }),
    countNeedsAttention: async () => {
      const sb = createServiceClient();
      const { count, error } = await sb
        .from("notification_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .like("last_error", `%${RETRIES_STOPPED}`);
      if (error) throw new Error(`needs-attention count failed: ${error.message}`);
      return count ?? 0;
    },
  });

  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
