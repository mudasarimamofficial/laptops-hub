import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { ok: false, error: "db_unreachable", detail: error.message, touchError: touchErr?.message ?? null },
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
