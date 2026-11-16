import { HomepageSectionEditor } from "@/components/admin/homepage-section-editor";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminOnlineStorePage() {
  await requireStaffPage(["owner", "admin", "editor"]);
  return (
    <>
      <AdminPageHeader
        title="Customize homepage"
        description="Draft section tree seeded from the approved V5 composition. Saving drafts never publishes. Live storefront stays on V5 code until an owner-approved publish."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Online store" }]}
      />
      <HomepageSectionEditor />
    </>
  );
}
