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
        description="Arrange, hide and edit the homepage sections of the approved V5 design, preview the full page, then publish. Saving a draft never changes the public site."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Online store" }]}
      />
      <HomepageSectionEditor />
    </>
  );
}
