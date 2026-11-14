import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSeoPage() {
  await requireStaffPage(["owner", "admin", "editor"]);
  return (
    <>
      <AdminPageHeader title="SEO & redirects" breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "SEO" }]} />
      <ModuleStatusPanel
        title="Marketing / SEO controls"
        phase="Phase 5–6"
        summary="Product SEO fields exist on the products table; page SEO and redirect manager expand with the CMS overhaul. Sitemap already reflects published routes."
        availableNow={[{ label: "Content pages", href: "/admin/content" }, { label: "Products", href: "/admin/products" }]}
      />
    </>
  );
}
