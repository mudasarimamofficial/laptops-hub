import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  provinces: z.array(z.string().trim().min(2)).min(1),
  cities: z.array(z.string().trim().min(2)).default([]),
  flatFeePkr: z.number().min(0).max(1_000_000),
  codFeePkr: z.number().min(0).max(1_000_000),
  isActive: z.boolean().default(false),
  notes: z.string().trim().max(500).default(""),
});

export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const { error } = await supabase.from("shipping_zones").insert({
      name: parsed.data.name,
      provinces: parsed.data.provinces,
      cities: parsed.data.cities,
      flat_fee_paisa: pkrMajorToPaisa(parsed.data.flatFeePkr),
      cod_fee_paisa: pkrMajorToPaisa(parsed.data.codFeePkr),
      is_active: parsed.data.isActive,
      notes: parsed.data.notes,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "shipping_zone.create",
      entity_type: "shipping_zones",
      after: parsed.data,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
