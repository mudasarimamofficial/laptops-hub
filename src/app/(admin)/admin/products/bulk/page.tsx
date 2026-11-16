import { BulkProductsForm } from "@/components/admin/bulk-products-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBulkEditorPage({ searchParams }: { searchParams: Promise<{ handles?: string }> }) {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const supabase = createServiceClient();
  // Products ticked on the product list arrive as ?handles=a,b,c (only handles that exist are kept, max 100).
  const wanted = ((await searchParams).handles ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => /^[a-z0-9][a-z0-9-]{0,200}$/.test(h))
    .slice(0, 100);
  const { data } = wanted.length
    ? await supabase.from("products").select("handle").in("handle", wanted).order("title")
    : await supabase.from("products").select("handle").order("title").limit(30);
  const handles = (data || []).map((p) => p.handle);

  return (
    <>
      <AdminPageHeader
        title="Bulk editor"
        description="Edit status, first-variant price, and featured flag for many products. Empty cells are left unchanged. Historical orders are never modified."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Bulk editor" },
        ]}
      />
      <BulkProductsForm initialHandles={handles} />
    </>
  );
}
