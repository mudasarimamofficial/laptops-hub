import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";
import { PendingBlock } from "@/components/ui/pending-block";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ status?: string; payment?: string; q?: string }> };

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireStaffPage(["owner", "admin", "manager", "fulfillment"]);

  const sp = await searchParams;
  const status = sp.status || "all";
  const payment = sp.payment || "all";
  const q = (sp.q || "").trim();

  let orders: {
    order_number: string;
    status: string;
    payment_status: string;
    total_due_paisa: number;
    amount_collected_paisa: number;
    customer_name: string;
    customer_phone_e164?: string | null;
    created_at: string;
  }[] = [];
  let error: string | null = null;

  try {
    const supabase = createServiceClient();
    let query = supabase
      .from("orders")
      .select(
        "order_number, status, payment_status, total_due_paisa, amount_collected_paisa, customer_name, customer_phone_e164, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") query = query.eq("status", status);
    if (payment !== "all") query = query.eq("payment_status", payment);
    if (q) {
      query = query.or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone_e164.ilike.%${q}%`,
      );
    }
    const { data, error: err } = await query;
    if (err) error = err.message;
    else orders = data || [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed";
  }

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="COD totals ≠ collected cash. Collection requires an explicit staff action on the order detail page."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { label: "Orders" },
        ]}
      />

      <form className="mt-2 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search order #, customer, phone"
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--adm-border)] px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-xl border border-[var(--adm-border)] px-3 py-2 text-sm">
          <option value="all">All fulfillment</option>
          <option value="placed">placed</option>
          <option value="confirmed">confirmed</option>
          <option value="packing">packing</option>
          <option value="shipped">shipped</option>
          <option value="out_for_delivery">out_for_delivery</option>
          <option value="delivered">delivered</option>
          <option value="cancelled">cancelled</option>
          <option value="returned">returned</option>
        </select>
        <select name="payment" defaultValue={payment} className="rounded-xl border border-[var(--adm-border)] px-3 py-2 text-sm">
          <option value="all">All payment</option>
          <option value="unpaid_cod">unpaid_cod</option>
          <option value="partially_collected">partially_collected</option>
          <option value="collected">collected</option>
          <option value="collection_failed">collection_failed</option>
        </select>
        <button type="submit" className="rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white">
          Apply filters
        </button>
      </form>

      {error ? (
        <div className="mt-6">
          <PendingBlock title="Orders unavailable" label="Error">
            {error}
          </PendingBlock>
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-[var(--adm-ink-2)]">No orders match these filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--adm-surface-2)] text-xs uppercase tracking-wide text-[var(--adm-ink-2)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Fulfillment</th>
                <th className="px-4 py-3">COD</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Collected</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_number} className="border-t border-[var(--adm-border)]">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/admin/orders/${o.order_number}`} className="text-[var(--lh-action)] hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.customer_name}</div>
                    {o.customer_phone_e164 ? (
                      <div className="text-xs text-[var(--adm-ink-2)]">{o.customer_phone_e164}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--adm-ink-2)]">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.payment_status} />
                  </td>
                  <td className="px-4 py-3">{formatPkr(o.total_due_paisa)}</td>
                  <td className="px-4 py-3">{formatPkr(o.amount_collected_paisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
