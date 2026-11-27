import Link from "next/link";
import { HomepageSectionEditor } from "@/components/admin/homepage-section-editor";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";


export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminOnlineStorePage() {
  const staff = await requireStaffPage(["owner", "admin", "editor"]);
  return (
    <>
      <AdminPageHeader
        title="Customize homepage"
        description="Arrange, hide and edit the homepage sections of the approved V5 design, preview the full page, then publish. Saving a draft never changes the public site."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Online store" }]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/merchandising" className="text-sm font-semibold text-[var(--adm-action)] hover:underline">
              Badges & social proof
            </Link>
            <Link href="/admin/navigation" className="text-sm font-semibold text-[var(--adm-action)] hover:underline">
              Navigation
            </Link>
          </div>
        }
      />
      <HomepageSectionEditor canPublish={staff.role === "owner" || staff.role === "admin"} />
    </>
  );
}
