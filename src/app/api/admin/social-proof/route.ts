import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { MERCH_SETTINGS_ROLES } from "@/lib/content/admin-roles";
import { parseSocialProof, SOCIAL_PROOF_KEY, socialProofSchema } from "@/lib/content/social-proof";

/**
 * Owner/admin/manager: save the social-proof settings (recent-order notices, data-backed top-seller badge, editorial
 * badges switch, reels heading/autoplay). The whole object is validated; the stored row is read back to confirm.
 * There is no "demo" or "test data" switch: notices and top-seller badges can only ever come from real orders.
 */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(MERCH_SETTINGS_ROLES);
    const parsed = socialProofSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path.join(".");
        if (!fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return NextResponse.json({ error: "validation_failed", message: "Check the highlighted fields.", fieldErrors }, { status: 400 });
    }
    const { data: beforeRow } = await supabase.from("store_settings").select("value").eq("key", SOCIAL_PROOF_KEY).maybeSingle();
    const { error } = await supabase
      .from("store_settings")
      .upsert({ key: SOCIAL_PROOF_KEY, value: parsed.data, updated_at: new Date().toISOString(), updated_by: staff.userId }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: "save_failed", message: "Could not save the settings." }, { status: 500 });
    const { data: after } = await supabase.from("store_settings").select("value").eq("key", SOCIAL_PROOF_KEY).maybeSingle();
    const persisted = parseSocialProof(after?.value);
    if (JSON.stringify(persisted) !== JSON.stringify(parsed.data)) {
      return NextResponse.json({ error: "verification_failed", message: "The settings could not be confirmed after saving." }, { status: 500 });
    }
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "social_proof.update",
      entity_type: "store_settings",
      before: beforeRow?.value ?? null,
      after: parsed.data,
    });
    revalidateTag("social-proof", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, persisted }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
