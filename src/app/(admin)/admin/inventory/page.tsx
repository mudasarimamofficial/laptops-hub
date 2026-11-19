import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { InventoryAdjustForm } from "@/components/admin/inventory-adjust-form";
import { requireStaffPage } from "@/lib/auth/staff";
import { INVENTORY_ADJUST_ROLES, INVENTORY_REASON_LABEL, LOW_STOCK_AT, stockState, type StockState } from "@/lib/commerce/inventory-adjust";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory", robots: { index: false, follow: false } };

const FILTERS = [
  ["all", "All tracked"],
  ["low", `Low (≤ ${LOW_STOCK_AT})`],
  ["out", "Out of stock"],
  ["oversell", "Selling when out of stock"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const STATE_TEXT: Record<StockState, string> = { ok: "In stock", low: "Low", out: "Out of stock", oversold: "Oversold" };
const STATE_CLASS: Record<StockState, string> = {
  ok: "border-[var(--adm-border)]",
  low: "border-amber-400 bg-amber-50",
  out: "border-[var(--adm-danger)] text-[var(--adm-danger)]",
  oversold: "border-[var(--adm-danger)] bg-red-50 text-[var(--adm-danger)]",
};
const fmt = (iso: string) => new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(iso));

type VariantRow = {
  id: string;
  sku: string | null;
  title: string | null;
  quantity_on_hand: number;
  allow_oversell: boolean | null;
  products: { title: string; handle: string; deleted_at: string | null } | null;
};

/**
 * Inventory desk: every tracked variant with its stock, low/out-of-stock markers, manual adjustments with a reason
 * (atomic: adjust_inventory), and the stock history (orders, cancellations, edits, adjustments) with who/when.
 * Quantities are only what staff enter; nothing is generated.
 */
export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  await requireStaffPage(INVENTORY_ADJUST_ROLES);
  const sp = await searchParams;
  const filter: Filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as Filter) : "all";
  const q = (sp.q || "").trim().slice(0, 80);
  const sb = createServiceClient();

  // Counts must use the same soft-delete filter as the list. Soft-deleted QA/archived products
  // still have tracked variants in the DB; including them made the header say "2 track stock"
  // while the desk showed an empty "Nothing matches" state.
  const liveTracked = () =>
    sb
      .from("product_variants")
      .select("id, products!inner(deleted_at)", { count: "exact", head: true })
      .eq("inventory_mode", "tracked")
      .is("products.deleted_at", null);
  const liveUntracked = () =>
    sb
      .from("product_variants")
      .select("id, products!inner(deleted_at)", { count: "exact", head: true })
      .eq("inventory_mode", "untracked")
      .is("products.deleted_at", null);

  let query = sb
    .from("product_variants")
    .select("id, sku, title, quantity_on_hand, allow_oversell, products!inner(title, handle, deleted_at)")
    .eq("inventory_mode", "tracked")
    .is("products.deleted_at", null)
    .order("quantity_on_hand", { ascending: true })
    .limit(200);
  if (filter === "low") query = query.gt("quantity_on_hand", 0).lte("quantity_on_hand", LOW_STOCK_AT);
  if (filter === "out") query = query.lte("quantity_on_hand", 0);
  if (filter === "oversell") query = query.eq("allow_oversell", true);
  if (q) query = query.ilike("sku", `%${q.replace(/[%_\\]/g, "")}%`);

  const [{ data }, { count: tracked }, { count: untracked }, { count: lowCount }, { count: outCount }, { data: history }] = await Promise.all([
    query,
    liveTracked(),
    liveUntracked(),
    liveTracked().gt("quantity_on_hand", 0).lte("quantity_on_hand", LOW_STOCK_AT),
    liveTracked().lte("quantity_on_hand", 0),
    sb
      .from("inventory_ledger")
      .select("id, delta, quantity_after, reason, reference_type, reference_id, created_at, product_variants(sku)")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const rows = (data || []) as unknown as VariantRow[];

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description={`${tracked ?? 0} variants track stock · ${lowCount ?? 0} low · ${outCount ?? 0} out of stock · ${untracked ?? 0} do not track stock ("ask to confirm availability" — not unlimited).`}
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Inventory" }]}
      />
      {(untracked ?? 0) > 0 ? (
        <p className="mb-4 rounded-[var(--adm-radius-lg)] border border-amber-300 bg-amber-50 p-3 text-sm">
          {untracked} variants do not track stock. To track one, open the product → Variants → set “Track stock” and enter the quantity you have
          counted. Only enter quantities you have physically checked.
        </p>
      ) : null}

      <nav aria-label="Stock filter" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {FILTERS.map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/inventory?filter=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={filter === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${filter === k ? "border-[var(--adm-action)] bg-[var(--adm-info-bg)] font-semibold" : "border-[var(--adm-border)] bg-white"}`}
          >
            {l}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={q} placeholder="SKU" aria-label="Find by SKU" className="w-36 rounded-lg border border-[var(--adm-border)] px-2 py-1" />
          <button type="submit" className="rounded-lg border border-[var(--adm-border)] bg-white px-3 py-1">Find</button>
        </form>
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-white p-6 text-sm text-[var(--adm-ink-2)]">
          {tracked ? "Nothing matches this filter." : "No variant tracks stock yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => {
            const state = stockState(v.quantity_on_hand);
            return (
              <li key={v.id} data-testid="inventory-row" data-sku={v.sku ?? ""} className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/products/${v.products?.handle}`} className="font-semibold hover:underline">
                      {v.products?.title}
                    </Link>
                    <p className="text-xs text-[var(--adm-ink-2)]">
                      {v.title && v.title !== "Default" ? `${v.title} · ` : ""}SKU {v.sku || "—"}
                      {v.allow_oversell ? " · keeps selling when out of stock (owner setting)" : ""}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATE_CLASS[state]}`} data-testid="inventory-qty">
                    {v.quantity_on_hand} · {STATE_TEXT[state]}
                  </span>
                </div>
                <div className="mt-3">
                  <InventoryAdjustForm variantId={v.id} sku={v.sku || v.id} quantity={v.quantity_on_hand} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold">Stock history</h2>
      <p className="text-sm text-[var(--adm-ink-2)]">Every change to tracked stock: orders, cancellations, product edits and adjustments. Who made an adjustment is in the Activity log.</p>
      <div className="adm-table-scroll mt-3 overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--adm-ink-2)]">
            <tr>
              <th scope="col" className="px-3 py-2">When</th>
              <th scope="col" className="px-3 py-2">SKU</th>
              <th scope="col" className="px-3 py-2">Change</th>
              <th scope="col" className="px-3 py-2">After</th>
              <th scope="col" className="px-3 py-2">Why</th>
            </tr>
          </thead>
          <tbody>
            {(history || []).map((h) => (
              <tr key={h.id} className="border-t border-[var(--adm-border)]">
                <td className="px-3 py-2 whitespace-nowrap">{fmt(h.created_at)}</td>
                <td className="px-3 py-2 font-[family-name:var(--font-mono)] text-xs">{(h.product_variants as { sku?: string } | null)?.sku ?? "—"}</td>
                <td className="px-3 py-2">{h.delta > 0 ? `+${h.delta}` : h.delta}</td>
                <td className="px-3 py-2">{h.quantity_after ?? "—"}</td>
                <td className="px-3 py-2">{INVENTORY_REASON_LABEL[h.reason] ?? h.reason}</td>
              </tr>
            ))}
            {!history?.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-[var(--adm-ink-2)]">No stock changes yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
