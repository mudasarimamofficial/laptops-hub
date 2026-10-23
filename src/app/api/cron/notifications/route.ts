import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processOutbox } from "@/lib/notify/outbox";

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
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
