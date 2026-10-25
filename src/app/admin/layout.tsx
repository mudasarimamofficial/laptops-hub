import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { getStaffMembership } from "@/lib/auth/staff";
import "../../styles/admin.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffMembership();

  return (
    <AdminShell
      staff={
        staff
          ? {
              email: staff.email,
              role: staff.role,
            }
          : null
      }
    >
      {children}
    </AdminShell>
  );
}
