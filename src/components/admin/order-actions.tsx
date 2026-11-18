"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPkr, paisaToMajor } from "@/lib/money";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";

const NEXT: Record<string, string[]> = {
  placed: ["pending_confirmation", "confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivery_failed"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivered: ["returned"],
  delivery_failed: ["shipped", "cancelled", "returned"],
  cancelled: [],
  returned: [],
  return_requested: ["returned", "cancelled"],
};

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  pending_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  packing: "Packing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delivery_failed: "Delivery failed",
  cancelled: "Cancelled",
  returned: "Returned",
  return_requested: "Return requested",
};

type Props = {
  orderNumber: string;
  status: string;
  totalDuePaisa: number;
  amountCollectedPaisa: number;
};

export function OrderActions({ orderNumber, status, totalDuePaisa, amountCollectedPaisa }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [statusDone, setStatusDone] = useState<{ from: string; to: string } | null>(null);
  const [collectedDone, setCollectedDone] = useState<{ from: number; value: number } | null>(null);
  const current = statusDone && statusDone.from === status ? statusDone.to : status;
  const collected = collectedDone && collectedDone.from === amountCollectedPaisa ? collectedDone.value : amountCollectedPaisa;
  const options = NEXT[current] || [];
  const outstanding = Math.max(0, totalDuePaisa - collected);

  const [toStatus, setToStatus] = useState(options[0] || "");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [collectPkr, setCollectPkr] = useState(String(paisaToMajor(outstanding) || ""));
  const [collectorRef, setCollectorRef] = useState("");
  const [busy, setBusy] = useState(false);
  const collectKey = useRef<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function changeStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!toStatus) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus,
          note,
          carrier: carrier || undefined,
          trackingNumber: trackingNumber || undefined,
          expectedFromStatus: current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Status update failed (${res.status})`);
        return;
      }
      setMsg(`Status → ${STATUS_LABEL[toStatus] || toStatus}`);
      setStatusDone({ from: status, to: toStatus });
      setToStatus((NEXT[toStatus] || [])[0] || "");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function collectCod(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const idempotencyKey = (collectKey.current ??=
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `cod-${orderNumber}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      const res = await fetch("/api/admin/cod-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          amountPkr: Number(collectPkr),
          collectorRef,
          note,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Collection failed (${res.status})`);
        return;
      }
      collectKey.current = null;
      if (typeof data.amountCollectedPaisa === "number") {
        setCollectedDone({ from: amountCollectedPaisa, value: data.amountCollectedPaisa });
        setCollectPkr(String(paisaToMajor(Math.max(0, totalDuePaisa - data.amountCollectedPaisa)) || ""));
      }
      setMsg(
        data.idempotentReplay
          ? `Already recorded (idempotent) · ${data.paymentStatus}`
          : `COD recorded · ${data.paymentStatus}`,
      );
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <AdminCard title="Fulfillment" description={`Current: ${STATUS_LABEL[current] || current}`}>
        <form method="post" onSubmit={changeStatus} className="space-y-3">
          {options.length ? (
            <>
              <AdminField label="Next step">
                <select className={admInputClass} value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s] || s}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Carrier" optional>
                <input className={admInputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
              </AdminField>
              <AdminField label="Tracking number" optional>
                <input className={admInputClass} value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
              </AdminField>
              <AdminField label="Note" optional>
                <input className={admInputClass} value={note} onChange={(e) => setNote(e.target.value)} />
              </AdminField>
              <button
                type="submit"
                disabled={busy || !hydrated}
                className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-5 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
              >
                Update status
              </button>
            </>
          ) : (
            <p className="text-sm text-[var(--adm-ink-2)]">No further transitions from this status.</p>
          )}
        </form>
      </AdminCard>

      <AdminCard
        title="COD cash collection"
        description={`Due ${formatPkr(totalDuePaisa)} · Collected ${formatPkr(collected)} · Outstanding ${formatPkr(outstanding)}. Delivery alone is not payment.`}
      >
        <form method="post" onSubmit={collectCod} className="space-y-3">
          {outstanding > 0 ? (
            <>
              <AdminField label="Amount collected (PKR)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={admInputClass}
                  value={collectPkr}
                  onChange={(e) => setCollectPkr(e.target.value)}
                  required
                />
              </AdminField>
              <AdminField label="Collector reference" optional hint="Courier or staff name">
                <input className={admInputClass} value={collectorRef} onChange={(e) => setCollectorRef(e.target.value)} placeholder="Courier / staff name" />
              </AdminField>
              <button
                type="submit"
                disabled={busy || !hydrated}
                className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-5 text-sm font-semibold disabled:opacity-50"
              >
                Record collection
              </button>
            </>
          ) : (
            <p className="text-sm text-[var(--adm-success)]">Fully collected.</p>
          )}
        </form>
      </AdminCard>

      {err ? (
        <p role="alert" className="text-sm text-[var(--adm-danger)] lg:col-span-2">
          {err}
        </p>
      ) : null}
      {msg ? <p className="text-sm text-[var(--adm-success)] lg:col-span-2">{msg}</p> : null}
    </div>
  );
}
