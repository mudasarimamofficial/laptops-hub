import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const LINKS: { href: string; label: string; note: string }[] = [
  {
    href: "/api/admin/products/export?format=shopify_modern&status=all",
    label: "Shopify modern CSV",
    note: "Current Shopify product export shape (UTF-8 BOM). Remote image URLs preserved.",
  },
  {
    href: "/api/admin/products/export?format=shopify_legacy&status=all",
    label: "Shopify legacy CSV",
    note: "Handle-first legacy columns for older Shopify exports.",
  },
  {
    href: "/api/admin/products/export?format=lh_extended&status=all",
    label: "Laptops HUB extended CSV",
    note: "Modern columns plus manufacturer, category, and variant title.",
  },
  {
    href: "/api/admin/products/export?format=inventory&status=all",
    label: "Inventory sidecar",
    note: "Handle, SKU, mode, quantity, oversell, price.",
  },
  {
    href: "/api/admin/products/export?format=collections",
    label: "Collection membership sidecar",
    note: "Manual collection product positions.",
  },
];

export default async function AdminProductExportPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);

  return (
    <>
      <AdminPageHeader
        title="Export products"
        description="Shopify-compatible and Laptops HUB sidecars. Image URLs remain remote references — nothing is rehosted."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Export" },
        ]}
      />
      <div className="space-y-4">
        {LINKS.map((l) => (
          <div
            key={l.href}
            className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
          >
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{l.label}</h2>
            <p className="mt-1 text-sm text-[var(--adm-ink-2)]">{l.note}</p>
            <a
              href={l.href}
              className="mt-3 inline-flex rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)]"
            >
              Download
            </a>
          </div>
        ))}
        <p className="text-sm">
          <Link href="/admin/products/import" className="font-semibold text-[var(--lh-action)] hover:underline">
            Open import preview
          </Link>
        </p>
      </div>
    </>
  );
}
