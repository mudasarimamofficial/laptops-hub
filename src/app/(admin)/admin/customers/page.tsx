import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminCustomersPage() {
  await requireStaffPage(["owner", "admin", "manager"]);
  const supabase = createServiceClient();
  // Derive from real orders only — no invented LTV
  const { data, count } = await supabase
    .from("orders")
    .select(
      "customer_name, customer_phone_normalized, customer_email, created_at, order_number, total_due_paisa, status",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = data || [];

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Profiles derived from validated order activity only. PII is role-gated."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Customers" }]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No customer orders yet"
          description="When COD orders are placed (isolated or after launch), buyers appear here from real order rows."
          actionHref="/admin/orders"
          actionLabel="View orders"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Latest order</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.order_number} className="border-t border-[var(--adm-divider)]">
                  <td className="px-4 py-3 font-medium">{o.customer_name || "—"}</td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                    {o.customer_phone_normalized}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/admin/orders/${o.order_number}`} className="text-[var(--lh-action)] hover:underline">
                      {o.order_number}
                    </a>
                  </td>
                  <td className="px-4 py-3">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--adm-divider)] px-4 py-2 text-xs text-[var(--adm-ink-2)]">
            Showing latest {rows.length} of {count ?? rows.length} order rows (not deduplicated profiles yet).
          </p>
        </div>
      )}
    </>
  );
}
