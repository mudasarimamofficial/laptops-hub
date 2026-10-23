import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ q?: string; page?: string; status?: string }> };

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
    .select("handle, title, status, featured, manufacturer, product_variants(price_paisa)", { count: "exact" })
    .order("title")
    .range(from, to);

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`title.ilike.%${q}%,handle.ilike.%${q}%`);

  const { data, count } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="lh-container py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Catalog</h1>
        <Link href="/admin" className="text-sm text-[var(--lh-action)]">
          ← Overview
        </Link>
      </div>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        {total} products · drafts stay private on the storefront · page {page}/{pages}
      </p>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title or handle"
          className="min-w-[200px] flex-1 rounded-xl border border-[var(--lh-border)] px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-xl border border-[var(--lh-border)] px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" className="rounded-[var(--lh-radius-pill)] border border-[var(--lh-border)] px-4 py-2 text-sm font-semibold">
          Filter
        </button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--lh-ice)] text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Handle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p) => {
              const price = (p.product_variants as { price_paisa: number }[] | null)?.[0]?.price_paisa ?? 0;
              return (
                <tr key={p.handle} className="border-t border-[var(--lh-divider)]">
                  <td className="px-4 py-3 font-medium">
                    {p.title}
                    {p.featured ? <span className="ml-2 text-xs text-[var(--lh-action)]">featured</span> : null}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">{p.handle}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">{formatPkr(price)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/products/${p.handle}`} className="text-[var(--lh-action)]">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="mt-6 flex gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/products?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`}
              className="text-[var(--lh-action)]"
            >
              ← Prev
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={`/admin/products?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`}
              className="text-[var(--lh-action)]"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
