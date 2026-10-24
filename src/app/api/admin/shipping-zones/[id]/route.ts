import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";
import { ZONE_COLUMNS, zoneInputProblem, zoneInputSchema } from "@/lib/commerce/zone-input";

type Ctx = { params: Promise<{ id: string }> };

/** Edit or (de)activate a zone. Zones are never deleted: past orders reference them. Answers with the stored row. */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found", message: "This zone no longer exists." }, { status: 404 });
    const parsed = zoneInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: zoneInputProblem(parsed.error) }, { status: 400 });
    }

    const { data: before } = await supabase
      .from("shipping_zones")
      .select("name, provinces, cities, flat_fee_paisa, cod_fee_paisa, is_active, notes")
      .eq("id", id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found", message: "This zone no longer exists." }, { status: 404 });

    const after = {
      name: parsed.data.name,
      provinces: parsed.data.provinces,
      cities: parsed.data.cities,
      flat_fee_paisa: pkrMajorToPaisa(parsed.data.flatFeePkr),
      cod_fee_paisa: pkrMajorToPaisa(parsed.data.codFeePkr),
      is_active: parsed.data.isActive,
      notes: parsed.data.notes,
    };
    const { data: zone, error } = await supabase.from("shipping_zones").update(after).eq("id", id).select(ZONE_COLUMNS).single();
    if (error || !zone) {
      console.error("shipping zone update failed", error?.code ?? "", error?.message ?? "");
      return NextResponse.json({ error: "server_error", message: "The zone could not be saved. Nothing was changed." }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "shipping_zone.update",
      entity_type: "shipping_zones",
      entity_id: id,
      before,
      after,
    });
    return NextResponse.json({ ok: true, zone }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
