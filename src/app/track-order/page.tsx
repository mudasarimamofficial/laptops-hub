import { TrackOrderForm } from "./track-form";

export const metadata = { title: "Track order", robots: { index: false, follow: true } };

export default function TrackOrderPage() {
  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Orders</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">Track order</h1>
      <p className="mt-3 max-w-2xl text-[var(--lh-ink-2)]">
        Enter your order number (for example LH-261023-A1B2C3) and the mobile number you used at checkout.
      </p>
      <TrackOrderForm />
    </div>
  );
}
