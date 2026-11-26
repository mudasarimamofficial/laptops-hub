"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPkr } from "@/lib/money";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";

export type LedgerEntry =
  | { type: "collection"; id: string; amountPaisa: number; reversedPaisa: number; at: string; by: string; collectorRef: string; note: string }
  | { type: "reversal" | "correction"; id: string; deltaPaisa: number; at: string; by: string; reason: string; collectionId: string | null };

type Props = {
  orderNumber: string;
  entries: LedgerEntry[];
  /** Owner, admin or manager. */
  canAdjust: boolean;
  /** False until the G22 database update is applied (the ledger table does not exist yet). */
  available: boolean;
  totalDuePaisa: number;
  collectedPaisa: number;
};

const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `adj-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const btn =
  "inline-flex min-h-9 items-center rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 text-sm font-semibold disabled:opacity-50";

/**
 * G22: append-only COD cash history for one order. Every collection, reversal and correction is listed with staff,
 * time and reason; nothing here edits a past entry or the order's totals.
 */
export function CodLedger({ orderNumber, entries, canAdjust, available, totalDuePaisa, collectedPaisa }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const key = useRef<{ sig: string; key: string } | null>(null);

  /** One key per distinct request, reused if the same request is retried (so a retry never records twice). */
  function keyFor(sig: string) {
    if (key.current?.sig !== sig) key.current = { sig, key: newKey() };
    return key.current.key;
  }

  async function send(body: Record<string, unknown>, sig: string, onOk: () => void) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/cod-collections/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, orderNumber, idempotencyKey: keyFor(sig) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `That did not work (${res.status}). Nothing was changed.`);
        return;
      }
      key.current = null;
      onOk();
      setMsg(
        `${data.idempotentReplay ? "Already recorded. " : ""}Collected now ${formatPkr(data.amountCollectedPaisa)} (${STATUS[data.paymentStatus] || data.paymentStatus}).`,
      );
      router.refresh();
    } catch {
      setErr("Network error: nothing was changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const sorted = entries.slice().sort((a, b) => b.at.localeCompare(a.at));

  return (
    <AdminCard
      title="Cash history"
      description={`Collected ${formatPkr(collectedPaisa)} of ${formatPkr(totalDuePaisa)}. Entries are permanent; mistakes are fixed with a reversal or correction.`}
      className="lg:col-span-2"
    >
      <ul className="space-y-2 text-sm" data-testid="cod-ledger">
        {sorted.length === 0 ? <li className="text-[var(--adm-ink-2)]">No cash recorded yet.</li> : null}
        {sorted.map((e) => (
          <li
            key={`${e.type}-${e.id}`}
            data-testid="cod-ledger-entry"
            data-kind={e.type}
            className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2"
          >
            {e.type === "collection" ? (
              <>
                <div className="font-medium">
                  Collected {formatPkr(e.amountPaisa)}
                  {e.reversedPaisa > 0 ? (
                    <span className="ml-2 text-xs text-[var(--adm-danger)]">
                      {e.reversedPaisa >= e.amountPaisa ? "Reversed" : `${formatPkr(e.reversedPaisa)} reversed`}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--adm-ink-2)]">
                  {new Date(e.at).toLocaleString("en-PK")} · recorded by {e.by}
                  {e.collectorRef ? ` · collector ${e.collectorRef}` : ""}
                </div>
                {e.note ? <div className="text-[var(--adm-ink-2)]">{e.note}</div> : null}
                {canAdjust && available && e.reversedPaisa < e.amountPaisa ? (
                  reversing === e.id ? (
                    <form
                      method="post"
                      className="mt-2 space-y-2"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        void send({ kind: "reversal", collectionId: e.id, reason: reverseReason }, `rev:${e.id}:${reverseReason.trim()}`, () => {
                          setReversing(null);
                          setReverseReason("");
                        });
                      }}
                    >
                      <AdminField label="Why is this collection being reversed?">
                        <input className={admInputClass} value={reverseReason} onChange={(ev) => setReverseReason(ev.target.value)} maxLength={500} />
                      </AdminField>
                      <div className="flex gap-2">
                        <button type="submit" className={btn} disabled={!hydrated || busy || reverseReason.trim().length < 5}>
                          Reverse {formatPkr(e.amountPaisa - e.reversedPaisa)}
                        </button>
                        <button type="button" className={btn} disabled={busy} onClick={() => setReversing(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className={`mt-2 ${btn}`}
                      disabled={!hydrated || busy}
                      aria-label={`Reverse the ${formatPkr(e.amountPaisa)} collection`}
                      onClick={() => {
                        setReversing(e.id);
                        setReverseReason("");
                      }}
                    >
                      Reverse…
                    </button>
                  )
                ) : null}
              </>
            ) : (
              <>
                <div className="font-medium">
                  {e.type === "reversal" ? "Reversal" : "Correction"} {e.deltaPaisa > 0 ? "+" : "−"}
                  {formatPkr(Math.abs(e.deltaPaisa))}
                </div>
                <div className="text-xs text-[var(--adm-ink-2)]">
                  {new Date(e.at).toLocaleString("en-PK")} · by {e.by}
                </div>
                <div>Reason: {e.reason}</div>
              </>
            )}
          </li>
        ))}
      </ul>

      {!available ? (
        <p className="mt-3 text-xs text-[var(--adm-ink-2)]" data-testid="cod-ledger-pending">
          Reversals and corrections become available after the pending database update.
        </p>
      ) : canAdjust ? (
        <form
          method="post"
          className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]"
          data-testid="cod-correction"
          onSubmit={(ev) => {
            ev.preventDefault();
            const n = Number(amount);
            const delta = direction === "remove" ? -n : n;
            void send({ kind: "correction", deltaPkr: delta, reason }, `cor:${delta}:${reason.trim()}`, () => {
              setAmount("");
              setReason("");
            });
          }}
        >
          <AdminField label="Correction">
            <select className={admInputClass} value={direction} onChange={(ev) => setDirection(ev.target.value as "remove" | "add")}>
              <option value="remove">Remove cash (counted too much / refunded)</option>
              <option value="add">Add cash (counted too little)</option>
            </select>
          </AdminField>
          <AdminField label="Amount (PKR)">
            <input type="number" min={1} step={1} className={admInputClass} value={amount} onChange={(ev) => setAmount(ev.target.value)} />
          </AdminField>
          <div className="sm:col-span-2">
            <AdminField label="Reason (kept permanently)">
              <input className={admInputClass} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} />
            </AdminField>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={btn} disabled={!hydrated || busy || !(Number(amount) > 0) || reason.trim().length < 5}>
              Record correction
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-xs text-[var(--adm-ink-2)]">Only the owner, an admin or a manager can reverse or correct cash.</p>
      )}

      {err ? (
        <p role="alert" className="mt-3 text-sm text-[var(--adm-danger)]" data-testid="cod-ledger-error">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="mt-3 text-sm text-[var(--adm-success)]" data-testid="cod-ledger-msg">
          {msg}
        </p>
      ) : null}
    </AdminCard>
  );
}

const STATUS: Record<string, string> = {
  unpaid_cod: "unpaid",
  partially_collected: "partly collected",
  collected: "fully collected",
  refunded_or_adjusted: "refunded or adjusted",
  collection_pending: "collection pending",
  collection_failed: "collection failed",
};
