import { requireStaffPage, type StaffRole } from "@/lib/auth/staff";
import { grantableRoles, STAFF_MANAGER_ROLES, staffChangeProblem } from "@/lib/auth/staff-admin";
import { listStaff } from "@/lib/auth/staff-directory";
import { emailConfigured } from "@/lib/notify/send-email";
import { createServiceClient } from "@/lib/supabase/server";
import { StaffInviteForm, StaffRowActions } from "@/components/admin/staff-manager";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { EmptyState } from "@/components/admin/ui/empty-state";

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
    <div>
      <AdminPageHeader
        title="Staff"
        description="Give each person their own admin login. They receive a one-time link to choose a password. Deactivating someone signs them out everywhere straight away."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { href: "/admin/settings", label: "Settings" }, { label: "Staff" }]}
      />

      <AdminCard title="Roles (what each person can do)" description="Roles are enforced on every save — hiding a menu is not security.">
        <ul className="grid gap-2 text-sm text-[var(--adm-ink-2)] sm:grid-cols-2">
          <li>
            <strong className="text-[var(--adm-ink)]">Owner</strong> — full access, restores CMS snapshots, manages all staff
          </li>
          <li>
            <strong className="text-[var(--adm-ink)]">Admin</strong> — store operations and most settings
          </li>
          <li>
            <strong className="text-[var(--adm-ink)]">Manager</strong> — catalog, orders, content; limited settings
          </li>
          <li>
            <strong className="text-[var(--adm-ink)]">Editor / Fulfillment</strong> — content or order desks only
          </li>
        </ul>
      </AdminCard>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-[var(--adm-ink)]">Invite someone</h2>
        {canEmail ? (
          <StaffInviteForm grantable={grantable} />
        ) : (
          <p role="status" className="mt-3 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-sm text-[var(--adm-ink-2)]">
            Invitations need email sending to be set up (Resend API key and a verified sender). Until then no invitation can be delivered.
          </p>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-[var(--adm-ink)]">People with access ({rows.length})</h2>
      {rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No staff listed" description="Invite a teammate above when email is configured." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--adm-surface-2)] text-xs uppercase tracking-wide text-[var(--adm-ink-2)]">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Person
                </th>
                <th scope="col" className="px-4 py-2">
                  Status
                </th>
                <th scope="col" className="px-4 py-2">
                  Last sign-in
                </th>
                <th scope="col" className="px-4 py-2">
                  Role / actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const editable =
                  staffChangeProblem({ actorId: staff.userId, actorRole: staff.role, targetId: r.userId, targetRole: r.role as StaffRole }) === null;
                return (
                  <tr key={r.userId} data-testid="staff-row" data-email={r.email ?? ""} className="border-t border-[var(--adm-border)] align-top">
                    <td className="px-4 py-3">
                      <span className="font-semibold">{r.email ?? "Unknown account"}</span>
                      {r.userId === staff.userId ? <span className="ml-2 text-xs text-[var(--adm-ink-2)]">(you)</span> : null}
                    </td>
                    <td className="px-4 py-3">{!r.active ? "Deactivated" : r.invitePending ? "Invited — not signed in yet" : "Active"}</td>
                    <td className="px-4 py-3">{fmt(r.lastSignInAt)}</td>
                    <td className="px-4 py-3">
                      <StaffRowActions
                        row={{
                          userId: r.userId,
                          email: r.email,
                          role: r.role,
                          active: r.active,
                          lastSignInAt: r.lastSignInAt,
                          invitePending: r.invitePending,
                        }}
                        grantable={grantable}
                        editable={editable}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
