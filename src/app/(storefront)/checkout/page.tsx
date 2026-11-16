import type { Metadata } from "next";
import { publicCheckoutAvailability } from "@/lib/commerce/checkout-readiness-server";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
// Readiness reads store settings, zones and policy approval at request time (no stale build-time-only gate).
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const { open } = await publicCheckoutAvailability();
  return <CheckoutForm orderingOpen={open} />;
}
