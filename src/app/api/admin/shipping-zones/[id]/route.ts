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
  isActive: z.boolean(),
  notes: z.string().trim().max(500).default(""),
});

type Ctx = { params: Promise<{ id: string }> };

/** Edit or (de)activate a zone. Zones are never deleted: past orders reference them. */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

    const { data: before } = await supabase
      .from("shipping_zones")
      .select("name, provinces, cities, flat_fee_paisa, cod_fee_paisa, is_active, notes")
      .eq("id", id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const after = {
      name: parsed.data.name,
      provinces: parsed.data.provinces,
      cities: parsed.data.cities,
      flat_fee_paisa: pkrMajorToPaisa(parsed.data.flatFeePkr),
      cod_fee_paisa: pkrMajorToPaisa(parsed.data.codFeePkr),
      is_active: parsed.data.isActive,
      notes: parsed.data.notes,
    };
    const { error } = await supabase.from("shipping_zones").update(after).eq("id", id);
    if (error) return NextResponse.json({ error: "server_error", message: "Could not save the zone." }, { status: 500 });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "shipping_zone.update",
      entity_type: "shipping_zones",
      entity_id: id,
      before,
      after,
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
