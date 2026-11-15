import { requireStaffPage, type StaffRole } from "@/lib/auth/staff";
import { grantableRoles, STAFF_MANAGER_ROLES, staffChangeProblem } from "@/lib/auth/staff-admin";
import { listStaff } from "@/lib/auth/staff-directory";
import { emailConfigured } from "@/lib/notify/send-email";
import { createServiceClient } from "@/lib/supabase/server";
import { StaffInviteForm, StaffRowActions } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff", robots: { index: false, follow: false } };

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(new Date(iso)) : "—";

/** Staff accounts: each person has their own login; nobody shares the owner's password. */
export default async function AdminStaffPage() {
  const staff = await requireStaffPage(STAFF_MANAGER_ROLES);
  const rows = await listStaff(createServiceClient());
  const grantable = grantableRoles(staff.role);
  const canEmail = emailConfigured();

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Staff</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--lh-ink-2)]">
        Give each person their own admin login. They receive a one-time link to choose a password; nobody needs to know anyone else&apos;s password.
        Deactivating someone signs them out everywhere straight away.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Invite someone</h2>
      {canEmail ? (
        <StaffInviteForm grantable={grantable} />
      ) : (
        <p role="status" className="mt-3 rounded-2xl border border-[var(--lh-border)] bg-white p-4 text-sm">
          Invitations need email sending to be set up (Resend API key and a verified sender). Until then no invitation can be delivered.
        </p>
      )}

      <h2 className="mt-10 text-lg font-semibold">People with access ({rows.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--lh-border)] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--lh-ice)] text-xs uppercase tracking-wide text-[var(--lh-ink-2)]">
            <tr>
              <th scope="col" className="px-4 py-2">Person</th>
              <th scope="col" className="px-4 py-2">Status</th>
              <th scope="col" className="px-4 py-2">Last sign-in</th>
              <th scope="col" className="px-4 py-2">Role / actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editable =
                staffChangeProblem({ actorId: staff.userId, actorRole: staff.role, targetId: r.userId, targetRole: r.role as StaffRole }) === null;
              return (
                <tr key={r.userId} data-testid="staff-row" data-email={r.email ?? ""} className="border-t border-[var(--lh-border)] align-top">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{r.email ?? "Unknown account"}</span>
                    {r.userId === staff.userId ? <span className="ml-2 text-xs text-[var(--lh-ink-2)]">(you)</span> : null}
                  </td>
                  <td className="px-4 py-3">{!r.active ? "Deactivated" : r.invitePending ? "Invited — not signed in yet" : "Active"}</td>
                  <td className="px-4 py-3">{fmt(r.lastSignInAt)}</td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <StaffRowActions row={r} grantable={grantable} editable />
                    ) : (
                      <span className="capitalize">{r.role}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-[var(--lh-ink-2)]">
        Owner changes (transferring ownership) are not done here; they need the database administrator and the owner&apos;s written instruction.
      </p>
    </div>
  );
}
