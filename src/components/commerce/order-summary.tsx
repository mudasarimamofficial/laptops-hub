import { formatPkr } from "@/lib/money";
import type { CustomerOrder } from "@/lib/orders/customer-view";

/** Customer-facing order view shared by the confirmation page and order lookup. No address or contact data. */
export function OrderSummary({ order }: { order: CustomerOrder }) {
  const placed = new Date(order.placedAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <section className="rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-6" aria-labelledby="ord-items">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--lh-ink-2)]">Order number</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold">{order.orderNumber}</p>
          </div>
          <p className="text-sm text-[var(--lh-ink-2)]">Placed {placed}</p>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--lh-canvas)] p-3">
            <dt className="text-xs text-[var(--lh-ink-2)]">Order status</dt>
            <dd className="font-semibold" data-testid="order-status">{order.statusLabel}</dd>
          </div>
          <div className="rounded-xl bg-[var(--lh-canvas)] p-3">
            <dt className="text-xs text-[var(--lh-ink-2)]">Payment</dt>
            <dd className="font-semibold">{order.paymentLabel}</dd>
          </div>
          {order.tracking ? (
            <div className="rounded-xl bg-[var(--lh-canvas)] p-3 sm:col-span-2">
              <dt className="text-xs text-[var(--lh-ink-2)]">Courier / tracking</dt>
              <dd className="font-semibold">
                {[order.tracking.carrier, order.tracking.trackingNumber].filter(Boolean).join(" · ")}
              </dd>
            </div>
          ) : null}
        </dl>
        <h2 id="ord-items" className="mt-6 text-sm font-semibold">Items</h2>
        <ul className="mt-2 divide-y divide-[var(--lh-border)] text-sm">
          {order.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-4 py-2">
              <span>
                {i.title}
                {i.variant && i.variant !== "Default" ? <span className="text-[var(--lh-ink-2)]"> · {i.variant}</span> : null}
                <span className="text-[var(--lh-ink-2)]"> × {i.quantity}</span>
              </span>
              <span className="whitespace-nowrap">{formatPkr(i.lineTotalPaisa)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-6" aria-labelledby="ord-total">
        <h2 id="ord-total" className="text-sm font-semibold">Cash due on delivery</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Items</dt><dd>{formatPkr(order.subtotalPaisa)}</dd></div>
          <div className="flex justify-between">
            <dt>Delivery{order.deliveryOption ? ` (${order.deliveryOption})` : ""}</dt>
            <dd>{formatPkr(order.shippingPaisa)}</dd>
          </div>
          {order.codFeePaisa > 0 ? <div className="flex justify-between"><dt>COD fee</dt><dd>{formatPkr(order.codFeePaisa)}</dd></div> : null}
          <div className="flex justify-between border-t border-[var(--lh-border)] pt-2 font-[family-name:var(--font-display)] text-lg font-bold">
            <dt>Total</dt><dd data-testid="order-total">{formatPkr(order.totalDuePaisa)}</dd>
          </div>
          {order.amountCollectedPaisa > 0 ? (
            <div className="flex justify-between text-[var(--lh-ink-2)]"><dt>Paid so far</dt><dd>{formatPkr(order.amountCollectedPaisa)}</dd></div>
          ) : null}
        </dl>
        {order.city ? <p className="mt-4 text-sm text-[var(--lh-ink-2)]">Delivering to {order.city}.</p> : null}
      </section>
    </div>
  );
}
