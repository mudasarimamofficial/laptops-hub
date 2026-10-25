import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminProductExportPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);

  return (
    <>
      <AdminPageHeader
        title="Export products"
        description="Download a Shopify-compatible modern CSV (UTF-8 BOM). Image URLs remain remote references. Multiple collections and ledger data need sidecar formats (coming next)."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Export" },
        ]}
      />
      <div className="space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Shopify modern CSV</h2>
        <p className="text-sm text-[var(--adm-ink-2)]">Up to 2,000 products per download. Staff-only; audited.</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/admin/products/export?format=shopify_modern&status=all"
            className="inline-flex rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)]"
          >
            Export all
          </a>
          <a
            href="/api/admin/products/export?format=shopify_modern&status=active"
            className="inline-flex rounded-lg border border-[var(--adm-border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
          >
            Active only
          </a>
          <a
            href="/api/admin/products/export?format=shopify_modern&status=draft"
            className="inline-flex rounded-lg border border-[var(--adm-border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
          >
            Drafts only
          </a>
        </div>
        <p className="text-sm text-[var(--adm-ink-2)]">
          Field-loss vs Shopify: multi-collection membership, inventory ledger, page builder, and private cost notes are
          not fully represented — use a future LH extended sidecar for those.
        </p>
        <p className="text-sm">
          <Link href="/admin/products/import" className="font-semibold text-[var(--lh-action)] hover:underline">
            Open import preview
          </Link>
        </p>
      </div>
    </>
  );
}
