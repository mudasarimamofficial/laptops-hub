import { requireStaffPage } from "@/lib/auth/staff";
import { grantableRoles, STAFF_MANAGER_ROLES } from "@/lib/auth/staff-admin";
import { listStaff } from "@/lib/auth/staff-directory";
import { emailConfigured } from "@/lib/notify/send-email";
import { createServiceClient } from "@/lib/supabase/server";
import { StaffDirectory } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff", robots: { index: false, follow: false } };

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

      <StaffDirectory
        initialRows={rows}
        grantable={grantable}
        currentUserId={staff.userId}
        currentUserRole={staff.role}
        canEmail={canEmail}
      />

      <p className="mt-4 text-xs text-[var(--lh-ink-2)]">
        Owner changes (transferring ownership) are not done here; they need the database administrator and the owner&apos;s written instruction.
      </p>
    </div>
  );
}
