"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cartSubtotalPaisa, useCart } from "@/lib/commerce/cart-store";
import { clearBuyNowLines, readBuyNowLines } from "@/lib/commerce/buy-now-store";
import { formatPkr } from "@/lib/money";
import { PendingBlock } from "@/components/ui/pending-block";
import { PK_PROVINCES } from "@/lib/commerce/pk-places";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { deliveryFeeLabel } from "@/lib/commerce/checkout-readiness";
import type { CartLine } from "@/types/catalog";


type ShipOption = {
  id: string;
  name: string;
  flatFeePaisa: number;
  codFeePaisa: number;
  freeShippingMinPaisa?: number | null;
  notes: string;
};

/**
 * `orderingOpen` is decided on the server from every gate (build flag, server flag, store setting, active zones,
 * published+approved policies, purchasable catalog) so the button is never clickable when the API would refuse.
 */
export function CheckoutForm({ orderingOpen }: { orderingOpen: boolean }) {
  const checkoutEnabled = orderingOpen;
  const router = useRouter();
  const searchParams = useSearchParams();
  const buyNowMode = searchParams.get("mode") === "buy_now";
  // Before hydration the submit stays disabled (and forms post): a click can never become a GET page reload.
  const hydrated = useHydrated();
  const cartLines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const [buyNowLines, setBuyNowLines] = useState<CartLine[]>([]);
  useEffect(() => {
    if (!buyNowMode) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only
    setBuyNowLines(readBuyNowLines());
  }, [buyNowMode]);
  const lines = useMemo(() => (buyNowMode ? buyNowLines : cartLines), [buyNowMode, buyNowLines, cartLines]);
  const localSubtotal = cartSubtotalPaisa(lines);
  const [pending, setPending] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [options, setOptions] = useState<ShipOption[]>([]);
  const [zoneId, setZoneId] = useState<string>("");
  const [serverQuote, setServerQuote] = useState<{
    subtotalPaisa: number;
    shippingPaisa: number;
    codFeePaisa: number;
    totalDuePaisa: number;
  } | null>(null);

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (city.trim().length < 2 || province.trim().length < 2 || lines.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear quote when address incomplete
      setOptions([]);
      setServerQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      setQuoting(true);
      setError(null);
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: { city, province },
            shippingZoneId: zoneId || undefined,
            lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          const opts: ShipOption[] = json.options || [];
          setOptions(opts);
          setServerQuote(null);
          // The address changed and the previously chosen zone no longer serves it: fall back to a matching zone.
          if (json.error === "zone_mismatch") {
            setZoneId(opts[0]?.id ?? "");
            return;
          }
          if (json.error === "unserviceable") setZoneId("");
          setError(
            json.error === "product_not_purchasable" || json.error === "variant_not_found"
              ? "An item in your cart is no longer available. Remove it from your cart and try again."
              : json.message || "Delivery is not available for this address.",
          );
          return;
        }
        const opts: ShipOption[] = json.options || [];
        setOptions(opts);
        if (!zoneId && opts[0]?.id) setZoneId(opts[0].id);
        setServerQuote(json.quote);
      } catch {
        setError("Could not calculate delivery");
      } finally {
        setQuoting(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [city, province, zoneId, lines]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!checkoutEnabled) {
      setError("Online ordering is not open yet.");
      return;
    }
    if (!zoneId) {
      setError("Choose a delivery option for your city.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = await fetch("/api/checkout/cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          customerName: fd.get("name"),
          customerPhone: fd.get("phone"),
          customerEmail: fd.get("email") || "",
          customerNote: fd.get("note") || "",
          shippingZoneId: zoneId,
          confirmCod: true,
          address: {
            line1: fd.get("line1"),
            line2: fd.get("line2") || "",
            city,
            province,
            postcode: fd.get("postcode") || "",
            landmark: fd.get("landmark") || "",
          },
          lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // The API always sends a shopper-facing message; never show a raw error code.
        setError(json.message || "Your order could not be placed. Please try again.");
        return;
      }
      if (buyNowMode) clearBuyNowLines();
      else clearCart();
      router.push(`/order/success/${json.accessToken}`);
    } catch {
      setError("Network error — your order may still have been placed. Check Track order before trying again.");
    } finally {
      setPending(false);
    }
  }

  if (hydrated && lines.length === 0) {
    return (
      <div className="lh-content py-12">
        <p className="lh-kicker">Checkout</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
          {buyNowMode ? "Nothing to check out" : "Your cart is empty"}
        </h1>
        <p className="mt-2 text-[var(--lh-ink-2)]">
          Add a laptop or accessory to continue to Cash on Delivery checkout.
        </p>
        <p className="mt-6">
          <Link href="/collections/all" className="lh-btn lh-btn-primary inline-flex">
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Checkout</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        Place COD order
      </h1>
      <p className="mt-2 text-[var(--lh-ink-2)]">
        Cash on Delivery: you pay when the parcel arrives. Enter your city and province to see the delivery options and
        the exact amount due.
        {buyNowMode ? " This checkout is for the item you chose with Buy now — your saved cart is unchanged." : null}
      </p>

      {!checkoutEnabled ? (
        <div className="mt-6">
          <PendingBlock title="Online ordering opens soon" label="Checkout">
            We are not accepting online orders yet. You can still browse, compare and build your cart.
          </PendingBlock>
        </div>
      ) : null}

      <form method="post" onSubmit={onSubmit} className="mt-8 grid gap-4 md:grid-cols-2" data-testid="checkout-form" data-ready={hydrated ? "true" : "false"}>
        <label className="block text-sm">
          Full name
          <input name="name" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm">
          Mobile (03XXXXXXXXX)
          <input name="phone" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm md:col-span-2">
          Email (optional)
          <input name="email" type="email" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm md:col-span-2">
          Street address
          <input name="line1" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm">
          City
          <input
            name="city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Province
          <select
            name="province"
            required
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] bg-white px-3 py-2"
          >
            <option value="">Select province</option>
            {PK_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Postcode
          <input name="postcode" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm">
          Landmark
          <input name="landmark" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>

        <fieldset className="md:col-span-2">
          <legend className="text-sm font-semibold">Delivery option</legend>
          {quoting ? <p className="mt-2 text-sm text-[var(--lh-ink-2)]">Checking coverage…</p> : null}
          {options.length === 0 && !error && city.length >= 2 && province.length >= 2 && !quoting ? (
            <p className="mt-2 text-sm text-[var(--lh-error)]">No COD delivery options for this city/province yet.</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--lh-border)] bg-white p-3"
              >
                <input
                  type="radio"
                  name="shippingOption"
                  checked={zoneId === o.id}
                  onChange={() => setZoneId(o.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold">{o.name}</span>
                  <span className="mt-1 block text-sm text-[var(--lh-ink-2)]">
                    {deliveryFeeLabel(o.flatFeePaisa, formatPkr)}
                    {o.codFeePaisa > 0 ? ` · COD fee ${formatPkr(o.codFeePaisa)}` : " · No COD fee"}
                    {o.freeShippingMinPaisa != null && o.flatFeePaisa > 0 ? ` · Free delivery on items from ${formatPkr(o.freeShippingMinPaisa)}` : ""}
                    {o.notes ? ` · ${o.notes}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm md:col-span-2">
          Note
          <textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>

        <div className="rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-4 md:col-span-2">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--lh-ink-2)]">
            Order summary
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Items: {formatPkr(serverQuote ? serverQuote.subtotalPaisa : localSubtotal)}</li>
            <li>Delivery: {serverQuote ? (serverQuote.shippingPaisa === 0 ? "Free" : formatPkr(serverQuote.shippingPaisa)) : "—"}</li>
            <li>COD fee: {serverQuote ? (serverQuote.codFeePaisa === 0 ? "None" : formatPkr(serverQuote.codFeePaisa)) : "—"}</li>
            <li className="pt-2 font-[family-name:var(--font-display)] text-lg font-bold">
              Cash due: {serverQuote ? formatPkr(serverQuote.totalDuePaisa) : "—"}
            </li>
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="confirm" required className="mt-1" />
          <span>
            I will pay the cash-due amount above on delivery, and I agree to the{" "}
            <Link href="/pages/terms" className="underline">terms</Link>,{" "}
            <Link href="/pages/returns" className="underline">returns policy</Link> and{" "}
            <Link href="/pages/privacy" className="underline">privacy policy</Link>.
          </span>
        </label>
        {error ? <p className="text-sm text-[var(--lh-error)] md:col-span-2">{error}</p> : null}
        <button
          type="submit"
          className="lh-btn lh-btn-primary md:col-span-2"
          disabled={pending || !hydrated || !checkoutEnabled || !zoneId || !serverQuote}
        >
          {pending ? "Placing order…" : "Place COD order"}
        </button>
      </form>
    </div>
  );
}
