import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";
import { ZONE_COLUMNS, zoneInputProblem, zoneInputSchema } from "@/lib/commerce/zone-input";

/** Create a shipping zone. Answers with the stored row, so staff see exactly what was saved. */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager"]);
    const body = await request.json().catch(() => null);
    const parsed = zoneInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: zoneInputProblem(parsed.error) }, { status: 400 });
    }

    const { data: zone, error } = await supabase
      .from("shipping_zones")
      .insert({
        name: parsed.data.name,
        provinces: parsed.data.provinces,
        cities: parsed.data.cities,
        flat_fee_paisa: pkrMajorToPaisa(parsed.data.flatFeePkr),
        cod_fee_paisa: pkrMajorToPaisa(parsed.data.codFeePkr),
        is_active: parsed.data.isActive,
        notes: parsed.data.notes,
      })
      .select(ZONE_COLUMNS)
      .single();

    if (error || !zone) {
      console.error("shipping zone insert failed", error?.code ?? "", error?.message ?? "");
      return NextResponse.json({ error: "server_error", message: "The zone could not be saved. Nothing was changed." }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "shipping_zone.create",
      entity_type: "shipping_zones",
      entity_id: zone.id,
      after: parsed.data,
    });

    return NextResponse.json({ ok: true, zone }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
