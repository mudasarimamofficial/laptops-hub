import type { createServiceClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/auth/staff";
import { staffInviteEmail } from "@/lib/auth/staff-invite-email";
import { sendEmail } from "@/lib/notify/send-email";
import { siteUrl } from "@/lib/site-url";

type Service = ReturnType<typeof createServiceClient>;

export type StaffRow = {
  userId: string;
  email: string | null;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  invitePending: boolean;
};

/** All memberships with their Auth email / sign-in state. Call only after an owner/admin check. */
export async function listStaff(supabase: Service): Promise<StaffRow[]> {
  const { data: rows } = await supabase.from("admin_memberships").select("user_id, role, is_active, created_at").order("created_at");
  const list = rows ?? [];
  const out: StaffRow[] = [];
  // Auth lookups run concurrently (bounded), not one round trip per member in sequence.
  for (let i = 0; i < list.length; i += 10) {
    const batch = list.slice(i, i + 10);
    const users = await Promise.all(batch.map((r) => supabase.auth.admin.getUserById(r.user_id).then(({ data }) => data?.user ?? null)));
    batch.forEach((r, j) => {
      const u = users[j];
      out.push({
        userId: r.user_id,
        email: u?.email ?? null,
        role: r.role as StaffRole,
        active: r.is_active,
        createdAt: r.created_at,
        lastSignInAt: u?.last_sign_in_at ?? null,
        invitePending: !!u && !u.last_sign_in_at,
      });
    });
  }
  return out;
}

export async function findUserIdByEmail(supabase: Service, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Create a one-time sign-in link (invite for a new person, recovery for an existing Auth user) and email it.
 * The link is built from SITE_URL, never from the request Host header, and lands on /admin/auth/confirm, which
 * opens "Set a new password". Returns the Auth user id and whether the email was accepted by the provider.
 */
export async function sendAccessLink(
  supabase: Service,
  input: { email: string; existing: boolean; role: string; invitedBy: string | null },
): Promise<{ ok: false } | { ok: true; userId: string; emailSent: boolean }> {
  const type = input.existing ? "recovery" : "invite";
  const { data, error } = await supabase.auth.admin.generateLink({ type, email: input.email });
  const token = data?.properties?.hashed_token;
  if (error || !token || !data.user) return { ok: false };
  const url = `${siteUrl()}/admin/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type}`;
  const msg = staffInviteEmail(input.role, url, input.invitedBy);
  const sent = await sendEmail({ to: input.email, subject: msg.subject, text: msg.text, idempotencyKey: `staff-access:${data.user.id}:${token.slice(0, 16)}` });
  return { ok: true, userId: data.user.id, emailSent: sent.ok };
}
