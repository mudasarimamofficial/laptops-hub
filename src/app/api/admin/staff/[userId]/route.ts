import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse, type StaffRole } from "@/lib/auth/staff";
import {
  ASSIGNABLE_ROLES,
  DEACTIVATED_BAN,
  STAFF_MANAGER_ROLES,
  STAFF_PROBLEM_MESSAGE,
  staffChangeProblem,
} from "@/lib/auth/staff-admin";
import { sendAccessLink } from "@/lib/auth/staff-directory";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";

const headers = { "Cache-Control": "no-store" };

const patchSchema = z.union([
  z.object({ action: z.literal("role"), role: z.enum(ASSIGNABLE_ROLES) }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("resend") }),
]);

/**
 * Change a member: role, deactivate (membership off + Auth ban, which revokes their refresh tokens so no session
 * can be renewed; every admin request also re-checks the membership, so access ends on the next request),
 * activate (membership on + ban lifted) or resend the one-time access link. Audited.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    }
    const { staff, supabase } = await createAuthorizedStaffWriter(STAFF_MANAGER_ROLES);
    const { userId } = await params;
    if (!z.string().uuid().safeParse(userId).success) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400, headers });
    const body = parsed.data;

    const { data: member } = await supabase.from("admin_memberships").select("role, is_active").eq("user_id", userId).maybeSingle();
    if (!member) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
    const problem = staffChangeProblem({
      actorId: staff.userId,
      actorRole: staff.role,
      targetId: userId,
      targetRole: member.role as StaffRole,
      nextRole: body.action === "role" ? body.role : undefined,
    });
    if (problem) return NextResponse.json({ error: problem, message: STAFF_PROBLEM_MESSAGE[problem] }, { status: 403, headers });

    const audit = (action: string, after: Record<string, unknown>) =>
      supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action,
        entity_type: "admin_memberships",
        entity_id: userId,
        before: { role: member.role, active: member.is_active },
        after,
      });

    if (body.action === "role") {
      const { error } = await supabase.from("admin_memberships").update({ role: body.role }).eq("user_id", userId);
      if (error) return NextResponse.json({ error: "update_failed" }, { status: 500, headers });
      await audit("staff.role_change", { role: body.role });
      return NextResponse.json({ ok: true, role: body.role }, { headers });
    }

    if (body.action === "deactivate" || body.action === "activate") {
      const active = body.action === "activate";
      const { error } = await supabase.from("admin_memberships").update({ is_active: active }).eq("user_id", userId);
      if (error) return NextResponse.json({ error: "update_failed" }, { status: 500, headers });
      const ban = await supabase.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : DEACTIVATED_BAN });
      await audit(active ? "staff.activate" : "staff.deactivate", { active, sessions_revoked: !active && !ban.error });
      return NextResponse.json({ ok: true, active, sessionsRevoked: !active && !ban.error }, { headers });
    }

    // resend
    if (!member.is_active) return NextResponse.json({ error: "inactive", message: "Activate this person first." }, { status: 409, headers });
    const limited = await rateLimit(`staff-invite:${staff.userId}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!limited.ok) return NextResponse.json({ error: "rate_limited", message: "Too many invitations. Try again later." }, { status: 429, headers });
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    if (!user?.user?.email) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
    const link = await sendAccessLink(supabase, {
      email: user.user.email.toLowerCase(),
      existing: !!user.user.last_sign_in_at || !!user.user.email_confirmed_at,
      role: member.role,
      invitedBy: staff.email,
    });
    await audit("staff.invite_resend", { email_sent: link.ok && link.emailSent });
    if (!link.ok || !link.emailSent) return NextResponse.json({ error: "email_failed", message: "The email could not be sent." }, { status: 502, headers });
    return NextResponse.json({ ok: true, emailSent: true }, { headers });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
