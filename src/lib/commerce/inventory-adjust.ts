import type { StaffRole } from "@/lib/auth/staff";

/** Who may change stock counts by hand (matches adjust_inventory's own membership check). */
export const INVENTORY_ADJUST_ROLES: StaffRole[] = ["owner", "admin", "manager"];

export const INVENTORY_REASONS = ["stock_received", "count_correction", "damaged_or_lost", "customer_return", "other"] as const;
export type InventoryReason = (typeof INVENTORY_REASONS)[number];

export const INVENTORY_REASON_LABEL: Record<string, string> = {
  stock_received: "Stock received",
  count_correction: "Count correction",
  damaged_or_lost: "Damaged or lost",
  customer_return: "Customer return (inspected)",
  other: "Other",
  // Written by the system, shown in the history:
  order_placed: "Order placed",
  order_cancelled: "Order cancelled — restocked",
  merchant_adjust: "Edited in product variants",
};

const MESSAGES: Record<string, string> = {
  negative_stock: "That would take stock below 0. Check the count and try again.",
  stale_quantity: "The stock changed while you were editing (an order may have come in). Reload and try again.",
  not_tracked: "This variant does not track stock. Turn on stock tracking in the product's variants first.",
  zero_adjustment: "That would not change the stock.",
  variant_not_found: "This variant no longer exists.",
  forbidden: "Your role cannot change stock (owner, admin or manager only).",
  expected_quantity_required: "Reload the page and try again.",
  invalid_reason: "Choose a reason.",
};

export function inventoryProblemMessage(code: string): string | null {
  return MESSAGES[code] ?? null;
}

/** Built-in low-stock line for the desk: at or below this many units (and above 0). */
export const LOW_STOCK_AT = 2;

/**
 * G16: Settings → Products & inventory → "Default low-stock threshold". A whole number 1–1000 replaces the built-in 2;
 * 0, empty or anything else keeps the built-in value (production stores 0 today, so the desk is unchanged until the
 * merchant sets a number).
 */
export function lowStockAtFrom(inventoryDefaults: unknown): number {
  const v = (inventoryDefaults as { low_stock_threshold?: unknown } | null | undefined)?.low_stock_threshold;
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 1000 ? n : LOW_STOCK_AT;
}

/** G16: Settings → "New products default to tracked inventory". */
export function newProductTrackedFrom(inventoryDefaults: unknown): boolean {
  return (inventoryDefaults as { tracked?: unknown } | null | undefined)?.tracked === true;
}

export type StockState = "out" | "low" | "ok" | "oversold";
export function stockState(qty: number, lowAt = LOW_STOCK_AT): StockState {
  if (qty < 0) return "oversold";
  if (qty === 0) return "out";
  if (qty <= lowAt) return "low";
  return "ok";
}
