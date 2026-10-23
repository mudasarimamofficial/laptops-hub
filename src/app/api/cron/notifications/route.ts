import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processOutbox, RETRIES_STOPPED } from "@/lib/notify/outbox";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Safety-net delivery of pending/failed notifications (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processOutbox({ limit: 25 });
  // Rows that no automatic retry will touch again: they need a staff decision (order page → Retry sending).
  const { count, error } = await createServiceClient()
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .like("last_error", `%${RETRIES_STOPPED}`);
  if (error) throw new Error(`needs-attention count failed: ${error.message}`);
  return NextResponse.json({ ...result, needsAttention: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
