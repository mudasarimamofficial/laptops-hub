import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminInventoryPage() {
  await requireStaffPage(["owner", "admin", "manager"]);
  const supabase = createServiceClient();
  const { count: tracked } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("inventory_mode", "tracked");
  const { count: untracked } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("inventory_mode", "untracked");

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description={`Live variant modes: ${tracked ?? 0} tracked · ${untracked ?? 0} confirm-availability (untracked). Untracked is not unlimited stock.`}
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Inventory" }]}
      />
      <ModuleStatusPanel
        title="Inventory policy & ledger"
        phase="Phase 3 — in progress"
        summary="Global default policy key inventory_policy is reserved in the additive migration. Variant-level mode already exists. Ledger table inventory_ledger ships with the migration for audited adjustments."
        availableNow={[{ label: "Edit variants via products", href: "/admin/products" }, { label: "Store settings", href: "/admin/settings" }]}
        nextSteps={[
          "Settings → Inventory typed form",
          "Manual adjustments with reason + audit",
          "Checkout concurrency tests on isolated stack",
        ]}
      />
    </>
  );
}
