import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";
import { PendingBlock } from "@/components/ui/pending-block";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function OrderSuccessPage({ params }: Props) {
  const { token } = await params;
  let order: {
    order_number: string;
    total_due_paisa: number;
    payment_status: string;
    status: string;
  } | null = null;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("orders")
      .select("order_number, total_due_paisa, payment_status, status")
      .eq("access_token", token)
      .maybeSingle();
    order = data;
  } catch {
    order = null;
  }

  if (!order) {
    return (
      <div className="lh-content py-12">
        <PendingBlock title="Order not found">
          This confirmation link is invalid or expired. Use Track order with your phone if you placed an order.
        </PendingBlock>
      </div>
    );
  }

  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Confirmation</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        Order placed
      </h1>
      <div className="mt-8 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-6">
        <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--lh-ink-2)]">Order number</p>
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold">{order.order_number}</p>
        <p className="mt-4 text-sm text-[var(--lh-ink-2)]">Cash due on delivery</p>
        <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          {formatPkr(order.total_due_paisa)}
        </p>
        <p className="mt-4 text-sm text-[var(--lh-ink-2)]">
          Payment status: <strong>{order.payment_status}</strong> (not marked paid until COD is collected) · Fulfillment:{" "}
          <strong>{order.status}</strong>
        </p>
        <p className="mt-4 text-sm text-[var(--lh-ink-2)]">
          We do not claim SMS/email was sent unless a verified provider is configured.
        </p>
      </div>
    </div>
  );
}
