import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { isCrossSite } from "@/lib/validation/contact";
import {
  testimonialSaveErrorMessage,
  TESTIMONIAL_APPROVE_ROLES,
  TESTIMONIAL_EDIT_ROLES,
  canTransition,
  publishBlockers,
  testimonialInputSchema,
  testimonialStatusSchema,
  toRow,
  type TestimonialStatus,
} from "@/lib/content/testimonials";

const crossSite = (r: Request) =>
  isCrossSite(r.headers.get("origin"), r.url, r.headers.get("x-forwarded-host") || r.headers.get("host"));
const noStore = { "Cache-Control": "no-store" };
const badId = (id: string) => !z.string().uuid().safeParse(id).success;

/** Staff: edit an entry's content. Editors may edit drafts and entries waiting for approval only. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(TESTIMONIAL_EDIT_ROLES);
    const { id } = await params;
    if (badId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = testimonialInputSchema.safeParse(raw?.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const { data: before } = await supabase.from("store_testimonials").select("*").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const approver = TESTIMONIAL_APPROVE_ROLES.includes(staff.role);
    if (!approver && !["draft", "pending"].includes(before.status)) {
      return NextResponse.json(
        { error: "forbidden", message: "Published or hidden entries can only be changed by the owner, an admin or a manager." },
        { status: 403 },
      );
    }
    if (before.status === "published") {
      const block = publishBlockers({
        source: parsed.data.source,
        source_url: parsed.data.sourceUrl || null,
        consent_confirmed: parsed.data.consentConfirmed,
        avatar_url: parsed.data.avatarUrl || null,
        avatar_permission: parsed.data.avatarPermission,
      });
      if (block) {
        return NextResponse.json(
          { error: "validation_failed", message: block },
          { status: 400 },
        );
      }
    }
    const row = { ...toRow(parsed.data), updated_by: staff.userId };
    const { error } = await supabase.from("store_testimonials").update(row).eq("id", id);
    if (error) {
      console.error("testimonial update failed", error.code);
      return NextResponse.json({ error: "save_failed", message: testimonialSaveErrorMessage(error) }, { status: 400 });
    }
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "testimonial.update",
      entity_type: "store_testimonials",
      entity_id: id,
      before: changed(before, row, "before"),
      after: changed(before, row, "after"),
    });
    if (before.status === "published") revalidateTag("testimonials", { expire: 0 });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Staff: change status (submit, approve/publish, hide, return to draft). Editors may only submit or withdraw. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(TESTIMONIAL_EDIT_ROLES);
    const { id } = await params;
    if (badId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = testimonialStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const { data: before } = await supabase
      .from("store_testimonials")
      .select("status, consent_confirmed, source, source_url, avatar_url, avatar_permission")
      .eq("id", id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const to = parsed.data.status;
    if (!canTransition(staff.role, before.status as TestimonialStatus, to)) {
      return NextResponse.json(
        { error: "forbidden", message: "Only the owner, an admin or a manager can publish or hide reviews." },
        { status: 403 },
      );
    }
    if (to === "published") {
      const block = publishBlockers({
        source: before.source as "google" | "website" | "merchant",
        source_url: before.source_url,
        consent_confirmed: before.consent_confirmed,
        avatar_url: before.avatar_url,
        avatar_permission: before.avatar_permission,
      });
      if (block) {
        return NextResponse.json({ error: "consent_required", message: block }, { status: 400 });
      }
    }
    const patch: Record<string, unknown> = { status: to, updated_by: staff.userId };
    if (to === "published" && before.status !== "published") {
      patch.approved_by = staff.userId;
      patch.published_at = new Date().toISOString();
    }
    const { error } = await supabase.from("store_testimonials").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: "update_failed", message: "Could not change the status." }, { status: 400 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: `testimonial.status.${to}`,
      entity_type: "store_testimonials",
      entity_id: id,
      before: { status: before.status },
      after: { status: to },
    });
    if (to === "published" || before.status === "published") revalidateTag("testimonials", { expire: 0 });
    return NextResponse.json({ ok: true, status: to }, { headers: noStore });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Owner/admin/manager: delete an entry entered by mistake (the audit log keeps a copy). Prefer "Hide". */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(TESTIMONIAL_APPROVE_ROLES);
    const { id } = await params;
    if (badId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: before } = await supabase.from("store_testimonials").select("*").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await supabase.from("store_testimonials").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "delete_failed", message: "Could not delete." }, { status: 400 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "testimonial.delete",
      entity_type: "store_testimonials",
      entity_id: id,
      before: { ...before, verification_note: before.verification_note ? "(set)" : "" },
    });
    if (before.status === "published") revalidateTag("testimonials", { expire: 0 });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Only the fields that changed, for a compact audit entry (internal notes are never copied into the log). */
function changed(before: Record<string, unknown>, after: Record<string, unknown>, side: "before" | "after") {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (k === "updated_by") continue;
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) {
      out[k] = k === "verification_note" ? "(changed)" : side === "before" ? before[k] : after[k];
    }
  }
  return out;
}
