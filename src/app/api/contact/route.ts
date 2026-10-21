import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(5).max(4000),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
