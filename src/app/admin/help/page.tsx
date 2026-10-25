import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminHelpPage() {
  await requireStaffPage();
  return (
    <>
      <AdminPageHeader
        title="Help"
        description="Merchant handbook expands as each module ships. COD stays off until owner launch approval."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Help" }]}
      />
      <div className="prose-sm max-w-3xl space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-sm">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Quick links</h2>
        <ul className="list-disc space-y-1 pl-5 text-[var(--lh-action)]">
          <li>
            <Link href="/admin/products/new">Add a product</Link>
          </li>
          <li>
            <Link href="/admin/products/import">Preview a Shopify CSV import</Link>
          </li>
          <li>
            <Link href="/admin/orders">Orders &amp; COD collection</Link>
          </li>
          <li>
            <Link href="/admin/settings">Shipping zones &amp; store settings</Link>
          </li>
        </ul>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Engineering docs</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>docs/CURSOR_MASTER_EXECUTION_STATE.md</code> — resume point
          </li>
          <li>
            <code>docs/ENTERPRISE_ADMIN_EXECUTION_MATRIX.md</code> — capability gaps
          </li>
          <li>
            <code>docs/EXTERNAL_MEDIA_POLICY.md</code> — Shopify CDN rights &amp; durability
          </li>
        </ul>
        <p className="text-[var(--adm-ink-2)]">
          Never invent shipping fees, warranty terms, or mark photo rights approved without owner confirmation.
        </p>
      </div>
    </>
  );
}
