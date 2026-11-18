import type { Metadata } from "next";
import { Suspense } from "react";
import { publicCheckoutAvailability } from "@/lib/commerce/checkout-readiness-server";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
// Readiness reads store settings, zones and policy approval at request time (no stale build-time-only gate).
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const { open } = await publicCheckoutAvailability();
  return (
    <Suspense fallback={<div className="lh-content py-12 text-sm text-[var(--lh-ink-2)]">Loading checkout…</div>}>
      <CheckoutForm orderingOpen={open} />
    </Suspense>
  );
}
