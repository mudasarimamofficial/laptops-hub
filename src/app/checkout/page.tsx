"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartSubtotalPaisa, useCart } from "@/lib/commerce/cart-store";
import { formatPkr } from "@/lib/money";
import { PendingBlock } from "@/components/ui/pending-block";

const checkoutEnabled = process.env.NEXT_PUBLIC_COD_CHECKOUT_ENABLED === "true";

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotalPaisa(lines);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : `k-${Date.now()}`),
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!checkoutEnabled) {
      setError("COD checkout is disabled until shipping zones and policies are configured.");
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
          shippingZoneId: fd.get("shippingZoneId"),
          confirmCod: true,
          address: {
            line1: fd.get("line1"),
            line2: fd.get("line2") || "",
            city: fd.get("city"),
            province: fd.get("province"),
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
      setError("Network error — your order may not have been placed. Do not resubmit without checking Track order.");
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
        Pay <strong className="text-[var(--lh-ink)]">{formatPkr(subtotal)}+</strong> in cash on delivery. Exact shipping
        is calculated server-side when zones are configured. No online payments.
      </p>

      {!checkoutEnabled ? (
        <div className="mt-6">
          <PendingBlock title="Live COD acceptance is off">
            Configure active shipping zones and set <code>cod_checkout.enabled</code> in store settings (and env flags)
            before accepting real orders. Form UI is ready for when the gate opens.
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
          <input name="city" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm">
          Province
          <input name="province" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm">
          Postcode
          <input name="postcode" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm">
          Landmark
          <input name="landmark" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="block text-sm md:col-span-2">
          Shipping zone ID (from admin — required when checkout enabled)
          <input
            name="shippingZoneId"
            placeholder="UUID of active shipping zone"
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            disabled={!checkoutEnabled}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          Note
          <textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="confirm" required className="mt-1" />
          I will pay the final cash-due amount to the courier / merchant on delivery (COD).
        </label>
        {error ? <p className="text-sm text-[var(--lh-error)] md:col-span-2">{error}</p> : null}
        <button type="submit" className="lh-btn lh-btn-primary md:col-span-2" disabled={pending || !checkoutEnabled}>
          {pending ? "Placing order…" : "Place COD order"}
        </button>
      </form>
    </div>
  );
}
