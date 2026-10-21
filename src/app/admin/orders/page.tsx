import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";
import { PendingBlock } from "@/components/ui/pending-block";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminOrdersPage() {
  let orders: {
    order_number: string;
    status: string;
    payment_status: string;
    total_due_paisa: number;
    amount_collected_paisa: number;
    customer_name: string;
    created_at: string;
  }[] = [];
  let error: string | null = null;

  try {
    const supabase = createServiceClient();
    const { data, error: err } = await supabase
      .from("orders")
      .select(
        "order_number, status, payment_status, total_due_paisa, amount_collected_paisa, customer_name, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (err) error = err.message;
    else orders = data || [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed";
  }

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Orders</h1>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        Placed COD totals ≠ collected cash. Collection requires an explicit staff action.
      </p>
      {error ? (
        <div className="mt-6">
          <PendingBlock title="Orders unavailable">{error}</PendingBlock>
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-[var(--lh-ink-2)]">No orders yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--lh-ice)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Collected</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_number} className="border-t border-[var(--lh-divider)]">
                  <td className="px-4 py-3 font-semibold">{o.order_number}</td>
                  <td className="px-4 py-3">{o.customer_name}</td>
                  <td className="px-4 py-3">{o.status}</td>
                  <td className="px-4 py-3">{o.payment_status}</td>
                  <td className="px-4 py-3">{formatPkr(o.total_due_paisa)}</td>
                  <td className="px-4 py-3">{formatPkr(o.amount_collected_paisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
