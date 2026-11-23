import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/notify/send-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function alertKeepaliveFailure(detail: string) {
  const to = process.env.STORE_NOTIFY_EMAIL;
  if (!emailConfigured() || !to) return { sent: false as const, reason: "notify_not_configured" };
  const day = new Date().toISOString().slice(0, 10);
  const result = await sendEmail({
    to,
    subject: `[Laptops HUB] Supabase keepalive failed (${day})`,
    text:
      "The Laptops HUB keepalive check could not reach the database.\n\n" +
      `Detail: ${detail.slice(0, 400)}\n\n` +
      "If the Supabase Free project is paused, resume it from the Supabase dashboard " +
      "(project xvmmjkrkgznnakcobmww), then verify home + /admin/login.\n" +
      "This alert is rate-limited to roughly one email per calendar day.",
    idempotencyKey: `keepalive-fail-${day}`,
  });
  return result.ok ? { sent: true as const, id: result.id } : { sent: false as const, reason: result.error };
}

/**
 * Lightweight genuine database activity for Supabase Free inactivity protection.
 * Requires Authorization: Bearer $CRON_SECRET (same as notification cron).
 * Does NOT guarantee the project will never pause — only reduces inactivity risk.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const source = new URL(request.url).searchParams.get("source") || "cron";
  const sb = createServiceClient();

  // Prefer the dedicated keepalive RPC (migration 20261123120000). Fall back to a tiny indexed read.
  const { data: touched, error: touchErr } = await sb.rpc("touch_keepalive", { p_source: source.slice(0, 80) });
  if (!touchErr && touched) {
    return NextResponse.json(
      { ok: true, mode: "touch_keepalive", ...((touched as object) || {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await sb.from("store_settings").select("key").limit(1);
  if (error) {
    const alert = await alertKeepaliveFailure(error.message || touchErr?.message || "db_unreachable");
    return NextResponse.json(
      {
        ok: false,
        error: "db_unreachable",
        detail: error.message,
        touchError: touchErr?.message ?? null,
        alert,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      mode: "store_settings_read",
      rows: data?.length ?? 0,
      touchError: touchErr?.message ?? null,
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
