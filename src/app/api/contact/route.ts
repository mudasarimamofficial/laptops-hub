import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { processContact } from "@/lib/validation/contact";

export async function POST(request: Request) {
  const result = await processContact(
    {
      origin: request.headers.get("origin"),
      url: request.url,
      host: request.headers.get("x-forwarded-host") || request.headers.get("host"),
      ip: clientIp(request),
      body: await request.json().catch(() => null),
    },
    {
      rateLimit: (key) => rateLimit(key, { limit: 5, windowMs: 15 * 60 * 1000 }),
      // Anon insert-only RLS (`inquiries_anon_insert`); rows are read by staff in /admin/inquiries.
      insert: async (row) => {
        const supabase = await createClient();
        const { error } = await supabase.from("contact_inquiries").insert(row);
        return { error: error ? error.message : null };
      },
    },
  );
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store", ...result.headers } });
}
