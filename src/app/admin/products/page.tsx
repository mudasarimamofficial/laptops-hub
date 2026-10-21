import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminProductsPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("products")
    .select("handle, title, status, product_variants(price_paisa)")
    .order("title")
    .limit(100);

  return (
    <div className="lh-container py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Catalog</h1>
        <Link href="/admin" className="text-sm text-[var(--lh-action)]">
          ← Overview
        </Link>
      </div>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">First 100 rows · drafts remain private on the storefront.</p>
      <div className="mt-8 overflow-x-auto rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--lh-ice)] text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Handle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Price</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p) => {
              const price = (p.product_variants as { price_paisa: number }[] | null)?.[0]?.price_paisa ?? 0;
              return (
                <tr key={p.handle} className="border-t border-[var(--lh-divider)]">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">{p.handle}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">{formatPkr(price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
