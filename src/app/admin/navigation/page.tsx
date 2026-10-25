import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminNavigationPage() {
  await requireStaffPage(["owner", "admin", "editor"]);
  return (
    <>
      <AdminPageHeader title="Navigation" breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Navigation" }]} />
      <ModuleStatusPanel
        title="Menus"
        phase="Phase 5"
        summary="Structured menus with nesting, drag-and-drop, and broken-link checks ship with the site editor. Unpublished policy links must stay hidden."
        availableNow={[{ label: "Content pages", href: "/admin/content" }]}
      />
    </>
  );
}
