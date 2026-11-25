import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };

/**
 * Admin → Your account (G23). Every staff role can change its own password here; Settings (owner, admin, manager)
 * keeps the same form under Security. The API verifies the current password and only changes the signed-in user.
 */
export default async function AdminAccountPage() {
  const staff = await requireStaffPage();
  return (
    <>
      <AdminPageHeader
        title="Your account"
        description="Settings for the login you are using now."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Your account" }]}
      />
      <div className="space-y-6">
        <AdminCard title="Sign-in details">
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="account-details">
            <dt className="text-[var(--adm-ink-2)]">Email</dt>
            <dd className="font-medium text-[var(--adm-ink)]">{staff.email || "—"}</dd>
            <dt className="text-[var(--adm-ink-2)]">Role</dt>
            <dd className="font-medium capitalize text-[var(--adm-ink)]">{staff.role}</dd>
          </dl>
          <p className="mt-2 text-xs text-[var(--adm-ink-2)]">Only an owner or admin can change your email or role, under Staff.</p>
        </AdminCard>
        <div id="password" className="scroll-mt-24">
          <AdminCard
            title="Password"
            description="Change the password for the account you are signed in with. This does not send an email, and you stay signed in here."
          >
            <ChangePasswordForm email={staff.email || "your account"} />
          </AdminCard>
        </div>
      </div>
    </>
  );
}
