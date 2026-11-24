import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { isCrossSite } from "@/lib/validation/contact";
import {
  testimonialSaveErrorMessage,
  TESTIMONIAL_APPROVE_ROLES,
  TESTIMONIAL_EDIT_ROLES,
  testimonialInputSchema,
  toRow,
} from "@/lib/content/testimonials";

const crossSite = (r: Request) =>
  isCrossSite(r.headers.get("origin"), r.url, r.headers.get("x-forwarded-host") || r.headers.get("host"));

/**
 * Staff: add a store testimonial. New entries start as a draft, or "waiting for approval" when an editor submits
 * directly; only owner/admin/manager may create one already published (and only with recorded consent).
 */
export async function POST(request: Request) {
  if (crossSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(TESTIMONIAL_EDIT_ROLES);
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = testimonialInputSchema.safeParse(raw?.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const wanted = raw?.status === "pending" || raw?.status === "published" ? raw.status : "draft";
    if (wanted === "published" && !TESTIMONIAL_APPROVE_ROLES.includes(staff.role)) {
      return NextResponse.json({ error: "forbidden", message: "Only the owner, an admin or a manager can publish." }, { status: 403 });
    }
    if (wanted === "published") {
      const { publishBlockers } = await import("@/lib/content/testimonials");
      const block = publishBlockers({
        source: parsed.data.source,
        source_url: parsed.data.sourceUrl || null,
        consent_confirmed: parsed.data.consentConfirmed,
        avatar_url: parsed.data.avatarUrl || null,
        avatar_permission: parsed.data.avatarPermission,
      });
      if (block) {
        return NextResponse.json({ error: "validation_failed", message: block }, { status: 400 });
      }
    }
    const now = new Date().toISOString();
    const row = {
      ...toRow(parsed.data),
      status: wanted,
      created_by: staff.userId,
      updated_by: staff.userId,
      ...(wanted === "published" ? { approved_by: staff.userId, published_at: now } : {}),
    };
    const { data, error } = await supabase.from("store_testimonials").insert(row).select("id, status").single();
    if (error || !data) {
      console.error("testimonial insert failed", error?.code);
      return NextResponse.json({ error: "save_failed", message: testimonialSaveErrorMessage(error) }, { status: 400 });
    }
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "testimonial.create",
      entity_type: "store_testimonials",
      entity_id: data.id,
      after: { ...row, verification_note: row.verification_note ? "(set)" : "" },
    });
    if (wanted === "published") revalidateTag("testimonials", { expire: 0 });
    return NextResponse.json({ ok: true, id: data.id, status: data.status }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
