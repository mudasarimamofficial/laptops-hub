import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { formatPkr } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ q?: string; page?: string; status?: string }> };

type ProductListRow = {
  handle: string;
  title: string;
  status: string;
  featured: boolean;
  manufacturer: string | null;
  updated_at: string;
  media_approval: string;
  product_variants: { price_paisa: number; sku: string | null; inventory_mode: string }[] | null;
  product_media: { url: string; alt: string; position: number }[] | null;
};

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);

  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const status = sp.status || "all";
  const page = Math.max(1, Number(sp.page || "1") || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createServiceClient();
  let query = supabase
    .from("products")
    .select(
      "handle, title, status, featured, manufacturer, updated_at, media_approval, product_variants(price_paisa, sku, inventory_mode), product_media(url, alt, position)",
      { count: "exact" },
    )
    .order("title")
    .range(from, to);

  if (status !== "all") query = query.eq("status", status);
  if (q) {
    query = query.or(`title.ilike.%${q}%,handle.ilike.%${q}%,manufacturer.ilike.%${q}%`);
  }

  const { data, count } = await query;
  const rows = (data || []) as ProductListRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${total} products · drafts stay private on the storefront · page ${page}/${pages}`}
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Products" }]}
        actions={
          <>
            <Link
              href="/admin/products/import"
              className="inline-flex rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
            >
              Import
            </Link>
            <Link
              href="/admin/products/export"
              className="inline-flex rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
            >
              Export
            </Link>
            <Link
              href="/admin/products/bulk"
              className="inline-flex rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
            >
              Bulk edit
            </Link>
            <Link
              href="/admin/products/new"
              className="inline-flex rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)]"
            >
              Add product
            </Link>
          </>
        }
      />

      <form className="mb-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, handle, or brand"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-sm"
          aria-label="Search products"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No products match"
          description="Try another search, or add a product / import a Shopify CSV."
          actionHref="/admin/products/new"
          actionLabel="Add product"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Inventory</th>
                <th className="px-4 py-3 font-semibold">Variants</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Media</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const variants = p.product_variants || [];
                const price = variants[0]?.price_paisa ?? 0;
                const media = [...(p.product_media || [])].sort((a, b) => a.position - b.position);
                const thumb = media[0];
                const modes = new Set(variants.map((v) => v.inventory_mode));
                const invLabel =
                  modes.size === 0 ? "—" : modes.has("tracked") && modes.has("untracked") ? "Mixed" : [...modes][0];
                return (
                  <tr key={p.handle} className="border-t border-[var(--adm-divider)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[var(--adm-border)] bg-[var(--adm-surface-2)]">
                          {thumb?.url ? (
                            <Image
                              src={thumb.url}
                              alt={thumb.alt || p.title}
                              fill
                              className="object-cover"
                              sizes="44px"
                              unoptimized
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {p.title}
                            {p.featured ? (
                              <span className="ml-2 text-xs font-normal text-[var(--lh-action)]">featured</span>
                            ) : null}
                          </p>
                          <p className="truncate font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                            {p.handle}
                            {p.manufacturer ? ` · ${p.manufacturer}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={invLabel === "tracked" ? "tracked" : "untracked"}>
                        {invLabel === "tracked"
                          ? "Tracked"
                          : invLabel === "Mixed"
                            ? "Mixed"
                            : "Confirm first"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">{variants.length}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPkr(price)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--adm-ink-2)]">{media.length}</span>
                      {p.media_approval === "pending" ? (
                        <span className="ml-2 text-xs text-[var(--adm-warning)]">rights pending</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--adm-ink-2)]">
                      {new Date(p.updated_at).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/products/${p.handle}`}
                        className="font-semibold text-[var(--lh-action)] hover:underline"
                      >
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

      {pages > 1 ? (
        <div className="mt-6 flex gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/products?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`}
              className="font-semibold text-[var(--lh-action)] hover:underline"
            >
              ← Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={`/admin/products?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`}
              className="font-semibold text-[var(--lh-action)] hover:underline"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
