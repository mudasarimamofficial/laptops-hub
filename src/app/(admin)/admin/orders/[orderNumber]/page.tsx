import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";
import { OrderActions } from "@/components/admin/order-actions";
import { CodLedger, type LedgerEntry } from "@/components/admin/cod-ledger";
import { NotificationRetry } from "@/components/admin/notification-retry";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ orderNumber: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const staff = await requireStaffPage(["owner", "admin", "manager", "fulfillment"]);
  const canAdjust = ["owner", "admin", "manager"].includes(staff.role);
  const { orderNumber } = await params;
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, payment_status, total_due_paisa, amount_collected_paisa,
       customer_name, customer_phone_e164, customer_email, customer_note,
       subtotal_paisa, shipping_paisa, cod_fee_paisa, tax_paisa, discount_paisa, created_at,
       order_addresses ( line1, line2, city, province, postcode, landmark ),
       order_items ( handle, title_snapshot, variant_title_snapshot, quantity, unit_price_paisa, line_total_paisa, unit_list_price_paisa, line_discount_paisa ),
       order_events ( event_type, from_status, to_status, note, created_at ),
       cod_collections ( id, amount_paisa, collector_ref, collected_at, note, recorded_by ),
       fulfillments ( carrier, tracking_number, dispatched_at, delivered_at )`,
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) notFound();

  const { data: outbox } = await supabase
    .from("notification_outbox")
    .select("channel, template, status, attempts, last_error, created_at, sent_at, business_status, customer_status, next_attempt_at")
    .eq("order_id", order.id)
    .order("created_at");

  const addr = Array.isArray(order.order_addresses) ? order.order_addresses[0] : order.order_addresses;
  const items = (order.order_items || []) as {
    handle: string;
    title_snapshot: string;
    variant_title_snapshot: string;
    quantity: number;
    unit_price_paisa: number;
    line_total_paisa: number;
    unit_list_price_paisa: number | null;
    line_discount_paisa: number | null;
  }[];
  const events = ((order.order_events || []) as { event_type: string; from_status: string | null; to_status: string | null; note: string; created_at: string }[])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const collections = (order.cod_collections || []) as {
    id: string;
    amount_paisa: number;
    collector_ref: string;
    collected_at: string;
    note: string;
    recorded_by: string | null;
  }[];

  // G22 ledger. Before its database update is applied the table does not exist: show history, hide corrections.
  const { data: adjRows, error: adjErr } = await supabase
    .from("cod_collection_adjustments")
    .select("id, collection_id, kind, delta_paisa, reason, recorded_by, created_at")
    .eq("order_id", order.id);
  const ledgerAvailable = !adjErr;
  const adjustments = (adjRows || []) as {
    id: string;
    collection_id: string | null;
    kind: "reversal" | "correction";
    delta_paisa: number;
    reason: string;
    recorded_by: string;
    created_at: string;
  }[];
  const staffLabel = await labelStaff(
    supabase,
    [...collections.map((c) => c.recorded_by), ...adjustments.map((a) => a.recorded_by)],
    canAdjust,
  );
  const ledger: LedgerEntry[] = [
    ...collections.map((c) => ({
      type: "collection" as const,
      id: c.id,
      amountPaisa: c.amount_paisa,
      reversedPaisa: -adjustments.filter((a) => a.kind === "reversal" && a.collection_id === c.id).reduce((n, a) => n + a.delta_paisa, 0),
      at: c.collected_at,
      by: staffLabel(c.recorded_by),
      collectorRef: c.collector_ref,
      note: c.note,
    })),
    ...adjustments.map((a) => ({
      type: a.kind,
      id: a.id,
      deltaPaisa: a.delta_paisa,
      at: a.created_at,
      by: staffLabel(a.recorded_by),
      reason: a.reason,
      collectionId: a.collection_id,
    })),
  ];
  const fulfillments = (order.fulfillments || []) as {
    carrier: string;
    tracking_number: string;
    dispatched_at: string | null;
    delivered_at: string | null;
  }[];

  return (
    <div>
      <AdminPageHeader
        title={order.order_number}
        description={`Placed ${new Date(order.created_at).toLocaleString("en-PK")} · COD due is not the same as cash collected.`}
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/orders", label: "Orders" },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={order.status} />
            <StatusBadge status={order.payment_status} />
            <Link href="/admin/orders" className="text-sm font-semibold text-[var(--adm-action)] hover:underline">
              ← Orders
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Customer">
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline text-[var(--adm-ink-2)]">Name · </dt>
              <dd className="inline">{order.customer_name}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--adm-ink-2)]">Phone · </dt>
              <dd className="inline">{order.customer_phone_e164}</dd>
            </div>
            {order.customer_email ? (
              <div>
                <dt className="inline text-[var(--adm-ink-2)]">Email · </dt>
                <dd className="inline">{order.customer_email}</dd>
              </div>
            ) : null}
            {addr ? (
              <div className="pt-2">
                <dt className="text-[var(--adm-ink-2)]">Delivery address</dt>
                <dd>
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ""}
                  <br />
                  {addr.city}, {addr.province}
                  {addr.postcode ? ` ${addr.postcode}` : ""}
                  {addr.landmark ? (
                    <>
                      <br />
                      Landmark: {addr.landmark}
                    </>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {order.customer_note ? (
              <div className="pt-2">
                <dt className="text-[var(--adm-ink-2)]">Delivery note</dt>
                <dd>{order.customer_note}</dd>
              </div>
            ) : null}
          </dl>
        </AdminCard>

        <AdminCard title="Totals">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPkr(order.subtotal_paisa)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{formatPkr(order.shipping_paisa)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>COD fee</dt>
              <dd>{formatPkr(order.cod_fee_paisa)}</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--adm-divider)] pt-2 font-semibold">
              <dt>Total due</dt>
              <dd>{formatPkr(order.total_due_paisa)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Collected</dt>
              <dd>{formatPkr(order.amount_collected_paisa)}</dd>
            </div>
            <div className="flex justify-between text-[var(--adm-ink-2)]">
              <dt>Payment</dt>
              <dd data-testid="order-payment-status">{order.payment_status}</dd>
            </div>
            <div className="flex justify-between text-[var(--adm-ink-2)]">
              <dt>Fulfillment</dt>
              <dd data-testid="order-fulfillment-status">{order.status}</dd>
            </div>
          </dl>
        </AdminCard>
      </div>

      <div className="adm-table-scroll mt-6 overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Line</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={`${it.handle}-${i}`} className="border-t border-[var(--adm-divider)]">
                <td className="px-4 py-3">
                  <div className="font-medium">{it.title_snapshot}</div>
                  {/* The configuration to pack (single-variant products are stored as "Default"). */}
                  {it.variant_title_snapshot && it.variant_title_snapshot !== "Default" ? (
                    <div className="text-xs" data-testid="order-item-variant">
                      {it.variant_title_snapshot}
                    </div>
                  ) : null}
                  <div className="font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">{it.handle}</div>
                </td>
                <td className="px-4 py-3">{it.quantity}</td>
                <td className="px-4 py-3">
                  {formatPkr(it.unit_price_paisa)}
                  {/* Discounted lines: unit is the price charged; the list price and saving are snapshots from order time. */}
                  {Number(it.line_discount_paisa) > 0 && it.unit_list_price_paisa ? (
                    <div className="text-xs text-[var(--adm-ink-2)]" data-testid="order-item-discount">
                      List {formatPkr(it.unit_list_price_paisa)} · saved {formatPkr(Number(it.line_discount_paisa))}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{formatPkr(it.line_total_paisa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OrderActions
        orderNumber={order.order_number}
        status={order.status}
        totalDuePaisa={order.total_due_paisa}
        amountCollectedPaisa={order.amount_collected_paisa}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="Activity">
          <ul className="space-y-2 text-sm">
            {events.length === 0 ? <li className="text-[var(--adm-ink-2)]">No events yet.</li> : null}
            {events.map((ev, i) => (
              <li key={`${ev.created_at}-${i}`} className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2">
                <div className="font-medium">
                  {ev.event_type}
                  {ev.from_status || ev.to_status ? ` · ${ev.from_status || "—"} → ${ev.to_status || "—"}` : ""}
                </div>
                {ev.note ? <div className="text-[var(--adm-ink-2)]">{ev.note}</div> : null}
                <div className="text-xs text-[var(--adm-ink-2)]">{new Date(ev.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Shipping">
          <ul className="space-y-2 text-sm">
            {fulfillments.map((f, i) => (
              <li key={`f-${i}`} className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2">
                {f.carrier || "Carrier"} · {f.tracking_number || "no tracking"}
              </li>
            ))}
            {fulfillments.length === 0 ? <li className="text-[var(--adm-ink-2)]">None yet.</li> : null}
          </ul>
        </AdminCard>

        <CodLedger
          orderNumber={order.order_number}
          entries={ledger}
          canAdjust={canAdjust}
          available={ledgerAvailable}
          totalDuePaisa={order.total_due_paisa}
          collectedPaisa={order.amount_collected_paisa}
        />

        <AdminCard title="Notifications" className="lg:col-span-2">
          <ul className="space-y-2 text-sm">
            {(outbox || []).length === 0 ? <li className="text-[var(--adm-ink-2)]">None queued.</li> : null}
            {(outbox || []).map((n, i) => (
              <li key={i} className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2" data-testid="notification-row">
                <div className="font-medium">
                  {n.template} · {n.channel} · <span data-testid="notification-status">{n.status}</span> · attempts {n.attempts}
                </div>
                <div className="text-xs text-[var(--adm-ink-2)]">
                  Store alert: <span data-testid="notification-business">{n.business_status}</span> · Customer email:{" "}
                  <span data-testid="notification-customer">{n.customer_status}</span>
                </div>
                {n.sent_at ? (
                  <div className="text-xs text-[var(--adm-ink-2)]">
                    Accepted by the email provider {new Date(n.sent_at).toLocaleString()} (delivery to the inbox is not confirmed)
                  </div>
                ) : null}
                {n.status === "failed" && !(n.last_error || "").endsWith("automatic retries stopped") && Number.isFinite(Date.parse(n.next_attempt_at)) ? (
                  <div className="text-xs text-[var(--adm-ink-2)]">Next automatic attempt after {new Date(n.next_attempt_at).toLocaleString()}</div>
                ) : null}
                {n.last_error ? <div className="text-xs text-[var(--adm-danger)]">{n.last_error}</div> : null}
              </li>
            ))}
          </ul>
          {(outbox || []).some((n) => n.status !== "accepted") ? <NotificationRetry orderNumber={order.order_number} /> : null}
        </AdminCard>
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", manager: "Manager", fulfillment: "Fulfillment", editor: "Editor" };

/**
 * Who recorded each cash entry. Owners, admins and managers see the staff email; fulfillment staff see the role only
 * (no colleague emails). Unknown or removed accounts show as "former staff".
 */
async function labelStaff(supabase: ReturnType<typeof createServiceClient>, ids: (string | null)[], showEmail: boolean) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const labels = new Map<string, string>();
  if (unique.length) {
    const { data: rows } = await supabase.from("admin_memberships").select("user_id, role").in("user_id", unique);
    const roles = new Map((rows || []).map((r) => [r.user_id as string, ROLE_LABEL[r.role as string] || String(r.role)]));
    const emails = showEmail
      ? await Promise.all(unique.map((id) => supabase.auth.admin.getUserById(id).then(({ data }) => data?.user?.email ?? null)))
      : unique.map(() => null);
    unique.forEach((id, i) => {
      const role = roles.get(id);
      labels.set(id, role ? (emails[i] ? `${role} (${emails[i]})` : role) : "former staff");
    });
  }
  return (id: string | null) => (id ? labels.get(id) || "former staff" : "not recorded");
}
