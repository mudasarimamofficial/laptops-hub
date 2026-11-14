import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ShopifyImportWizard } from "@/components/admin/shopify-import-wizard";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminProductImportPage() {
  await requireStaffPage(["owner", "admin", "manager"]);

  return (
    <>
      <AdminPageHeader
        title="Import products"
        description="Upload a Shopify product CSV (modern or legacy headers). Preview and dry-run before any catalog writes. Production imports require separate owner approval."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Import" },
        ]}
      />
      <ShopifyImportWizard />
    </>
  );
}
