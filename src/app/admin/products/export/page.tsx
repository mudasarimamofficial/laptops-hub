import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminProductExportPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);

  return (
    <>
      <AdminPageHeader
        title="Export products"
        description="Shopify-compatible CSV and Laptops HUB extended sidecar exports."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Export" },
        ]}
      />
      <ModuleStatusPanel
        title="Export pipeline"
        phase="Phase 4 — in progress"
        summary="Header mapping and CSV safety helpers are in place (src/lib/catalog/shopify-csv.ts). Streaming export endpoints and filtered selection ship next; Production PII-safe exports stay permission-gated."
        availableNow={[
          { label: "Import preview wizard", href: "/admin/products/import" },
          { label: "Product catalog", href: "/admin/products" },
        ]}
        nextSteps={[
          "GET /api/admin/products/export?format=shopify_modern|legacy|lh_extended|inventory|collections",
          "Formula-injection neutralization on export cells",
          "Selected/filtered export with accurate counts",
        ]}
      />
      <p className="mt-4 text-sm text-[var(--adm-ink-2)]">
        See also <Link href="/admin/help" className="text-[var(--lh-action)] hover:underline">Help</Link> for field-loss
        notes vs Shopify CSV.
      </p>
    </>
  );
}
