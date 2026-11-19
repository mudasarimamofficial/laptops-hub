import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { adminSearchTerm, phoneDigits } from "@/lib/admin/search-term";
import { formatPkr } from "@/lib/money";
import { emailConfigured } from "@/lib/notify/send-email";
import { PendingBlock } from "@/components/ui/pending-block";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { StatusBadge } from "@/components/admin/ui/status-badge";


export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ status?: string; payment?: string; q?: string }> };

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireStaffPage(["owner", "admin", "manager", "fulfillment"]);

  const sp = await searchParams;
  const status = sp.status || "all";
  const payment = sp.payment || "all";
  const q = adminSearchTerm(sp.q);

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
      const digits = phoneDigits(q);
      query = query.or(
        [`order_number.ilike.%${q}%`, `customer_name.ilike.%${q}%`, ...(digits ? [`customer_phone_normalized.ilike.%${digits}%`] : [])].join(","),
      );
    }
    const { data, error: err } = await query;
    if (err) {
      console.error("[admin/orders] list failed", err);
      error = "Orders could not be loaded. Reload the page or try again shortly.";
    }
    else orders = data || [];
  } catch (e) {
    console.error("[admin/orders] list failed", e);
    error = "Orders could not be loaded. Reload the page or try again shortly.";
  }

  const mailReady = emailConfigured() && !!process.env.STORE_NOTIFY_EMAIL;

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="COD totals ≠ collected cash. Collection requires an explicit staff action on the order detail page. New orders start as placed / pending confirmation — confirm availability before packing or courier booking."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { label: "Orders" },
        ]}
      />

      {!mailReady ? (
        <div
          role="status"
          className="mb-4 rounded-[var(--adm-radius-lg)] border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          data-testid="orders-email-fallback"
        >
          <p className="font-semibold">Email notifications are not configured</p>
          <p className="mt-1 text-amber-900/90">
            Watch this Orders list for new COD submissions. Orders are still saved in the database; nothing is marked sent when
            Resend is missing. Set <code className="font-mono text-xs">RESEND_API_KEY</code>,{" "}
            <code className="font-mono text-xs">STORE_FROM_EMAIL</code>, and{" "}
            <code className="font-mono text-xs">STORE_NOTIFY_EMAIL</code> on Vercel when the owner account is ready.
          </p>
        </div>
      ) : null}

      <form className="adm-filter-bar mt-2 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search order #, customer, phone"
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--adm-border)] px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 py-2 text-sm">
          <option value="all">All fulfillment</option>
          <option value="placed">Placed</option>
          <option value="confirmed">Confirmed</option>
          <option value="packing">Packing</option>
          <option value="shipped">Shipped</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
        </select>
        <select name="payment" defaultValue={payment} className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 py-2 text-sm">
          <option value="all">All payment</option>
          <option value="unpaid_cod">Unpaid COD</option>
          <option value="partially_collected">Partially collected</option>
          <option value="collected">Collected</option>
          <option value="collection_failed">Collection failed</option>
        </select>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)]"
        >
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
        <div className="mt-6">
          <EmptyState
            title="No orders match"
            description={
              q || status !== "all" || payment !== "all"
                ? "Try clearing search or filters. New COD orders appear here after checkout."
                : "When customers place COD orders, they show up here for confirmation and fulfillment."
            }
          />
        </div>
      ) : (
        <>
        <div className="adm-mobile-cards mt-6" data-testid="orders-mobile-cards">
          {orders.map((o) => (
            <article key={`m-${o.order_number}`} className="adm-mobile-card">
              <p className="adm-mobile-card__title">{o.order_number}</p>
              <p className="adm-mobile-card__meta">
                {o.customer_name}
                {o.customer_phone_e164 ? ` · ${o.customer_phone_e164}` : ""}
              </p>
              <p className="adm-mobile-card__meta">{new Date(o.created_at).toLocaleString("en-PK")}</p>
              <div className="adm-mobile-card__row">
                <StatusBadge status={o.status} />
                <StatusBadge status={o.payment_status} />
              </div>
              <p className="adm-mobile-card__meta">
                Due {formatPkr(o.total_due_paisa)} · Collected {formatPkr(o.amount_collected_paisa)}
              </p>
              <Link href={`/admin/orders/${o.order_number}`} className="adm-mobile-card__action">
                Open order
              </Link>
            </article>
          ))}
        </div>
        <div className="adm-desktop-table adm-table-scroll mt-6 overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <table className="w-full min-w-[640px] text-left text-sm">
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
                    <Link href={`/admin/orders/${o.order_number}`} className="text-[var(--adm-action)] hover:underline">
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
        </>
      )}
    </>
  );
}
