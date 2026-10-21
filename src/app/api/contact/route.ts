import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(5).max(4000),
  /** Honeypot — bots fill this; humans leave empty */
  company: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit(`contact:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", message: "Invalid submission." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (parsed.data.company) {
    // Silent success for honeypot fills — do not store
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_inquiries").insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    subject: parsed.data.subject || "",
    message: parsed.data.message,
  });

  if (error) {
    return NextResponse.json(
      { error: "submit_failed", message: "Could not save your message." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
