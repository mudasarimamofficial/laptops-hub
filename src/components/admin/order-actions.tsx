"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPkr, paisaToMajor } from "@/lib/money";

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

type Props = {
  orderNumber: string;
  status: string;
  totalDuePaisa: number;
  amountCollectedPaisa: number;
};

export function OrderActions({ orderNumber, status, totalDuePaisa, amountCollectedPaisa }: Props) {
  const router = useRouter();
  const options = NEXT[status] || [];
  const outstanding = Math.max(0, totalDuePaisa - amountCollectedPaisa);

  const [toStatus, setToStatus] = useState(options[0] || "");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [collectPkr, setCollectPkr] = useState(String(paisaToMajor(outstanding) || ""));
  const [collectorRef, setCollectorRef] = useState("");
  const [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ toStatus, note, carrier: carrier || undefined, trackingNumber: trackingNumber || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Status update failed (${res.status})`);
        return;
      }
      setMsg(`Status → ${toStatus}`);
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function collectCod(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/cod-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          amountPkr: Number(collectPkr),
          collectorRef,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Collection failed (${res.status})`);
        return;
      }
      setMsg(`COD recorded · ${data.paymentStatus}`);
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <form onSubmit={changeStatus} className="space-y-3 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Fulfillment status</h2>
        <p className="text-sm text-[var(--lh-ink-2)]">Current: {status}</p>
        {options.length ? (
          <>
            <label className="block text-sm">
              <span className="font-medium">Next status</span>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
              >
                {options.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Carrier (optional)</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Tracking (optional)</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Note</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Update status
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--lh-ink-2)]">No further transitions from this status.</p>
        )}
      </form>

      <form onSubmit={collectCod} className="space-y-3 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">COD cash collection</h2>
        <p className="text-sm text-[var(--lh-ink-2)]">
          Due {formatPkr(totalDuePaisa)} · Collected {formatPkr(amountCollectedPaisa)} · Outstanding{" "}
          {formatPkr(outstanding)}
        </p>
        <p className="text-xs text-[var(--lh-ink-2)]">Delivery alone is not payment. Record cash explicitly.</p>
        {outstanding > 0 ? (
          <>
            <label className="block text-sm">
              <span className="font-medium">Amount collected (PKR)</span>
              <input
                type="number"
                min={1}
                step={1}
                className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
                value={collectPkr}
                onChange={(e) => setCollectPkr(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Collector reference</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
                value={collectorRef}
                onChange={(e) => setCollectorRef(e.target.value)}
                placeholder="Courier / staff name"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-[var(--lh-radius-pill)] border border-[var(--lh-border)] px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Record collection
            </button>
          </>
        ) : (
          <p className="text-sm text-emerald-700">Fully collected.</p>
        )}
      </form>

      {err ? <p className="text-sm text-red-600 lg:col-span-2">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700 lg:col-span-2">{msg}</p> : null}
    </div>
  );
}
