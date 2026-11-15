/**
 * Order analytics for Admin → Analytics (master prompt §12). Pure: callers pass orders (in the chosen window, by
 * order date) and the COD collections recorded against them. Definitions are shown to staff on the page:
 *  - placed: every order in the window, any status
 *  - delivered / cancelled / returned / delivery failed: orders now in that status
 *  - open: still moving (placed → out for delivery, or a return requested)
 *  - cash collected: COD cash actually recorded for these orders (never assumed from status)
 *  - outstanding: delivered orders' cash due minus cash recorded for them (what couriers/riders still owe)
 *  - expected on open orders: cash due on orders not yet delivered (not revenue)
 */
export type OrderLite = { id: string; status: string; total_due_paisa: number };
export type CollectionLite = { order_id: string; amount_paisa: number };

const OPEN = new Set(["placed", "pending_confirmation", "confirmed", "packing", "shipped", "out_for_delivery", "return_requested"]);

export type OrderAnalytics = {
  placed: number;
  placedValuePaisa: number;
  delivered: number;
  cancelled: number;
  returned: number;
  deliveryFailed: number;
  open: number;
  cashCollectedPaisa: number;
  outstandingPaisa: number;
  expectedOnOpenPaisa: number;
};

export function orderAnalytics(orders: OrderLite[], collections: CollectionLite[]): OrderAnalytics {
  const collectedBy = new Map<string, number>();
  for (const c of collections) collectedBy.set(c.order_id, (collectedBy.get(c.order_id) ?? 0) + c.amount_paisa);
  const ids = new Set(orders.map((o) => o.id));
  const a: OrderAnalytics = {
    placed: orders.length,
    placedValuePaisa: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
    deliveryFailed: 0,
    open: 0,
    cashCollectedPaisa: 0,
    outstandingPaisa: 0,
    expectedOnOpenPaisa: 0,
  };
  for (const [orderId, amount] of collectedBy) if (ids.has(orderId)) a.cashCollectedPaisa += amount;
  for (const o of orders) {
    a.placedValuePaisa += o.total_due_paisa;
    if (o.status === "delivered") {
      a.delivered++;
      a.outstandingPaisa += Math.max(0, o.total_due_paisa - (collectedBy.get(o.id) ?? 0));
    } else if (o.status === "cancelled") a.cancelled++;
    else if (o.status === "returned") a.returned++;
    else if (o.status === "delivery_failed") a.deliveryFailed++;
    else if (OPEN.has(o.status)) {
      a.open++;
      a.expectedOnOpenPaisa += o.total_due_paisa;
    }
  }
  return a;
}

export const ANALYTICS_WINDOWS = [
  ["7", "Last 7 days", 7],
  ["30", "Last 30 days", 30],
  ["90", "Last 90 days", 90],
  ["all", "All time", null],
] as const;
