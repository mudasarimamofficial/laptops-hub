import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import {
  ASSIGNABLE_ROLES,
  STAFF_MANAGER_ROLES,
  STAFF_PROBLEM_MESSAGE,
  staffChangeProblem,
  staffEmail,
} from "@/lib/auth/staff-admin";
import { findUserIdByEmail, listStaff, sendAccessLink } from "@/lib/auth/staff-directory";
import { emailConfigured } from "@/lib/notify/send-email";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(STAFF_MANAGER_ROLES);
    return NextResponse.json({ staff: await listStaff(supabase) }, { headers });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

const inviteSchema = z.object({ email: z.string(), role: z.enum(ASSIGNABLE_ROLES) });

/** Invite a person by email with a role (owner/admin; see src/lib/auth/staff-admin.ts for who may grant what). */
export async function POST(request: Request) {
  try {
    if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    }
    const { staff, supabase } = await createAuthorizedStaffWriter(STAFF_MANAGER_ROLES);
    const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
    const email = parsed.success ? staffEmail(parsed.data.email) : null;
    if (!parsed.success || !email) {
      return NextResponse.json({ error: "validation_failed", message: "Enter a valid email address and choose a role." }, { status: 400, headers });
    }
    const problem = staffChangeProblem({ actorId: staff.userId, actorRole: staff.role, targetRole: null, nextRole: parsed.data.role });
    if (problem) return NextResponse.json({ error: problem, message: STAFF_PROBLEM_MESSAGE[problem] }, { status: 403, headers });
    const limited = await rateLimit(`staff-invite:${staff.userId}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!limited.ok) return NextResponse.json({ error: "rate_limited", message: "Too many invitations. Try again later." }, { status: 429, headers });
    if (!emailConfigured()) {
      return NextResponse.json(
        { error: "email_not_configured", message: "Email sending is not set up, so no invitation can be delivered. Nothing was changed." },
        { status: 409, headers },
      );
    }

    const existingId = await findUserIdByEmail(supabase, email);
    if (existingId) {
      const { data: member } = await supabase.from("admin_memberships").select("role").eq("user_id", existingId).maybeSingle();
      if (member) {
        return NextResponse.json(
          { error: "already_staff", message: "This person already has admin access. Change their role in the list instead." },
          { status: 409, headers },
        );
      }
    }

    const link = await sendAccessLink(supabase, { email, existing: !!existingId, role: parsed.data.role, invitedBy: staff.email });
    if (!link.ok) return NextResponse.json({ error: "invite_failed", message: "The invitation could not be created. Try again." }, { status: 502, headers });

    const { error: memberError } = await supabase
      .from("admin_memberships")
      .insert({ user_id: link.userId, role: parsed.data.role, is_active: true, created_by: staff.userId });
    if (memberError) return NextResponse.json({ error: "invite_failed", message: "The invitation could not be saved." }, { status: 500, headers });
    // An Auth user who was deactivated before (and then removed from staff) may still be banned.
    if (existingId) await supabase.auth.admin.updateUserById(link.userId, { ban_duration: "none" });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "staff.invite",
      entity_type: "admin_memberships",
      entity_id: link.userId,
      after: { role: parsed.data.role, email_sent: link.emailSent },
    });
    return NextResponse.json(
      link.emailSent
        ? { ok: true, emailSent: true, userId: link.userId }
        : { ok: true, emailSent: false, userId: link.userId, message: "Access was recorded, but the email could not be sent. Use “Resend invitation”." },
      { status: link.emailSent ? 201 : 202, headers },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
