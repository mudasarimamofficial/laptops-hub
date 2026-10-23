import Link from "next/link";
import { headers } from "next/headers";
import { PendingBlock } from "@/components/ui/pending-block";
import { OrderSummary } from "@/components/commerce/order-summary";
import { getOrderByToken } from "@/lib/orders/customer-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your order",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer" as const,
};

type Props = { params: Promise<{ token: string }> };

export default async function OrderSuccessPage({ params }: Props) {
  const { token } = await params;
  // Ensure intermediaries do not cache confirmation pages with opaque tokens
  await headers();
  const order = await getOrderByToken(token).catch(() => null);

  if (!order) {
    return (
      <div className="lh-content py-12">
        <PendingBlock title="Order not found" label="Your order">
          This order link is not valid. If you placed an order, look it up with your order number and phone on{" "}
          <Link href="/track-order" className="underline">Track order</Link>.
        </PendingBlock>
      </div>
    );
  }

  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Order received</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">Thank you — your order is in</h1>
      <p className="mt-3 max-w-2xl text-[var(--lh-ink-2)]">
        Our team reviews every order and confirms availability with you on the phone number you gave before it is
        dispatched. You pay in cash when the parcel arrives.
      </p>
      <OrderSummary order={order} />
      <p className="mt-6 text-sm text-[var(--lh-ink-2)]">
        Keep this page&apos;s link to check your order later, or use{" "}
        <Link href="/track-order" className="underline">Track order</Link> with your order number and phone.
      </p>
    </div>
  );
}
