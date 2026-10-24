import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { INQUIRY_STAFF_ROLES } from "@/lib/auth/inquiry-roles";

const schema = z.object({ status: z.enum(["new", "open", "closed"]) });

/** Staff: move an inquiry between new / open / closed (audited). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(INQUIRY_STAFF_ROLES);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const { data: before } = await supabase.from("contact_inquiries").select("status").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await supabase.from("contact_inquiries").update({ status: parsed.data.status }).eq("id", id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "inquiry.status",
      entity_type: "contact_inquiries",
      entity_id: id,
      before: { status: before.status },
      after: { status: parsed.data.status },
    });
    return NextResponse.json({ ok: true, status: parsed.data.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
