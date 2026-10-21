"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartSubtotalPaisa, useCart } from "@/lib/commerce/cart-store";
import { formatPkr } from "@/lib/money";
import { PendingBlock } from "@/components/ui/pending-block";

const checkoutEnabled = process.env.NEXT_PUBLIC_COD_CHECKOUT_ENABLED === "true";

type ShipOption = {
  id: string;
  name: string;
  flatFeePaisa: number;
  codFeePaisa: number;
  notes: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
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

  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : `k-${Date.now()}`),
    [],
  );

  useEffect(() => {
    if (city.trim().length < 2 || province.trim().length < 2 || lines.length === 0) {
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
          setOptions(json.options || []);
          setServerQuote(null);
          setError(json.message || json.error || "Delivery not available for this address");
          return;
        }
        setOptions(json.options || []);
        if (!zoneId && json.options?.[0]?.id) setZoneId(json.options[0].id);
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
      setError("COD checkout is disabled until shipping zones and policies are configured.");
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
        setError(json.message || json.error || "Checkout failed");
        return;
      }
      clear();
      router.push(`/order/success/${json.accessToken}`);
    } catch {
      setError("Network error — do not resubmit without checking Track order.");
    } finally {
      setPending(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="lh-content py-12">
        <PendingBlock title="Cart is empty">
          <Link href="/collections/all" className="text-[var(--lh-action)]">
            Browse products
          </Link>
        </PendingBlock>
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
        Cash on Delivery only. Delivery options appear after you enter a city we serve. Totals are calculated on the
        server — browser estimates are not trusted.
      </p>

      {!checkoutEnabled ? (
        <div className="mt-6">
          <PendingBlock title="Live COD acceptance is off">
            Configure active shipping zones (cities/provinces + fees) in admin, then enable{" "}
            <code>cod_checkout</code> after owner approval. Quote UX works for staff testing once zones exist; public
            placement stays blocked.
          </PendingBlock>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
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
          <input
            name="province"
            required
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          />
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
          {options.length === 0 && city.length >= 2 && province.length >= 2 && !quoting ? (
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
                    Delivery {formatPkr(o.flatFeePaisa)}
                    {o.codFeePaisa > 0 ? ` · COD fee ${formatPkr(o.codFeePaisa)}` : ""}
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
            Order summary (server quote)
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Items (browser estimate): {formatPkr(localSubtotal)}</li>
            <li>Items (server): {serverQuote ? formatPkr(serverQuote.subtotalPaisa) : "—"}</li>
            <li>Delivery: {serverQuote ? formatPkr(serverQuote.shippingPaisa) : "—"}</li>
            <li>COD fee: {serverQuote ? formatPkr(serverQuote.codFeePaisa) : "—"}</li>
            <li className="pt-2 font-[family-name:var(--font-display)] text-lg font-bold">
              Cash due: {serverQuote ? formatPkr(serverQuote.totalDuePaisa) : "—"}
            </li>
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="confirm" required className="mt-1" />
          I will pay the final cash-due amount on delivery (COD).
        </label>
        {error ? <p className="text-sm text-[var(--lh-error)] md:col-span-2">{error}</p> : null}
        <button
          type="submit"
          className="lh-btn lh-btn-primary md:col-span-2"
          disabled={pending || !checkoutEnabled || !zoneId || !serverQuote}
        >
          {pending ? "Placing order…" : "Place COD order"}
        </button>
      </form>
    </div>
  );
}
