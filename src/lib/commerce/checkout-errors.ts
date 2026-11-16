/**
 * Stable checkout error codes → HTTP status + shopper-facing message. create_cod_order raises these codes; the quote
 * route uses the same codes for the same conditions so the quote and the final order agree. Anything not listed is
 * answered with a generic message (raw database text is never returned to the public).
 */
type Mapped = { status: number; message: string };

const CODES: Record<string, Mapped> = {
  variant_not_found: { status: 409, message: "An item in your cart is no longer available. Remove it from your cart and try again." },
  product_not_purchasable: { status: 409, message: "An item in your cart is no longer available. Remove it from your cart and try again." },
  insufficient_stock: { status: 409, message: "An option in your cart has just sold out or has fewer units left than you asked for. Update your cart and try again." },
  quantity_exceeds_limit: { status: 409, message: "You have more of an item than can be ordered at once. Lower the quantity and try again." },
  invalid_quantity: { status: 400, message: "Check the quantities in your cart and try again." },
  invalid_lines: { status: 400, message: "Your cart is empty or could not be read. Add the items again." },
  address_incomplete: { status: 400, message: "Enter your street address, city and province." },
  shipping_unavailable: { status: 403, message: "We do not currently deliver COD to this city/province." },
  zone_mismatch: { status: 409, message: "The delivery option no longer matches your address. Choose a delivery option again." },
  shipping_required: { status: 400, message: "Choose a delivery option for your city." },
  checkout_disabled: { status: 403, message: "Online ordering is not available right now. Please contact Laptops HUB to order." },
  invalid_idempotency_key: { status: 400, message: "Reload checkout and try again." },
};

export function checkoutErrorCode(raw: string | null | undefined): string | null {
  const text = raw || "";
  return Object.keys(CODES).find((code) => text.includes(code)) ?? null;
}

export function mapCheckoutError(raw: string | null | undefined): { error: string; status: number; message: string } {
  const code = checkoutErrorCode(raw);
  if (code) return { error: code, ...CODES[code] };
  return { error: "order_failed", status: 500, message: "Your order could not be placed. Nothing was charged — please try again in a moment." };
}
