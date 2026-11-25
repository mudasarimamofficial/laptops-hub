import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { newProductTrackedFrom } from "@/lib/commerce/inventory-adjust";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminNewProductPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const { data: invDefaults } = await createServiceClient()
    .from("store_settings")
    .select("value")
    .eq("key", "inventory_defaults")
    .maybeSingle();

  return (
    <>
      <AdminPageHeader
        title="Add product"
        description="Creates a draft (or active) product with one default variant. Add media, options, and SEO on the next screen."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Add product" },
        ]}
      />
      <ProductCreateForm defaultTracked={newProductTrackedFrom(invDefaults?.value)} />
    </>
  );
}
