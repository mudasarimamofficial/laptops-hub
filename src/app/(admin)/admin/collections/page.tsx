import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  featured: boolean;
  rule: unknown;
  sort_order: number;
  collection_products: { count: number }[] | null;
};

function isAutomated(rule: unknown): boolean {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  const keys = Object.keys(rule as Record<string, unknown>);
  return keys.length > 0;
}

export default async function AdminCollectionsPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("collections")
    .select("id, slug, title, published, featured, rule, sort_order, collection_products(count)")
    .order("sort_order")
    .order("title");

  const rows = (data || []) as CollectionRow[];

  return (
    <>
      <AdminPageHeader
        title="Collections"
        description="Organize products into manual and rule-based collections. Storefront brand/spec/category filters continue to work alongside these."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Collections" }]}
        actions={
          <Link
            href="/admin/collections/new"
            className="inline-flex rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)]"
          >
            Create collection
          </Link>
        }
      />

      {error ? (
        <p className="rounded-lg border border-[var(--adm-danger)] bg-[var(--adm-danger-bg)] px-4 py-3 text-sm text-[var(--adm-danger)]">
          Could not load collections. Try again.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description="Create a manual collection or an automated rule-based set (for example HP + 16 GB RAM)."
          actionHref="/admin/collections/new"
          actionLabel="Create collection"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Handle</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Products</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const count = c.collection_products?.[0]?.count ?? 0;
                const automated = isAutomated(c.rule);
                return (
                  <tr key={c.id} className="border-t border-[var(--adm-divider)]">
                    <td className="px-4 py-3 font-medium">
                      {c.title}
                      {c.featured ? (
                        <span className="ml-2 text-xs font-normal text-[var(--lh-action)]">featured</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                      {c.slug}
                    </td>
                    <td className="px-4 py-3">{automated ? "Automated" : "Manual"}</td>
                    <td className="px-4 py-3">{automated ? "—" : count}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.published ? "published" : "draft"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/collections/${c.slug}`} className="font-semibold text-[var(--lh-action)] hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
