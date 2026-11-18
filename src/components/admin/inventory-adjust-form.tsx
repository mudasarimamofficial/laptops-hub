"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { INVENTORY_REASONS, INVENTORY_REASON_LABEL } from "@/lib/commerce/inventory-adjust";

/** One row's stock change: add/remove units, or set the counted quantity. The server is the source of truth. */
export function InventoryAdjustForm({ variantId, sku, quantity }: { variantId: string; sku: string; quantity: number }) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<string>("stock_received");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (amount.trim() === "" || !Number.isInteger(n)) {
      setMsg({ kind: "error", text: "Enter a whole number." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "set" ? { variantId, mode, amount: n, expectedQuantity: quantity, reason, note } : { variantId, mode, amount: n, reason, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ kind: "error", text: json.message || `Failed (${res.status})` });
      else {
        setMsg({ kind: "ok", text: `Saved. Stock is now ${json.quantityAfter}.` });
        setAmount("");
        setNote("");
        router.refresh();
      }
    } catch {
      setMsg({ kind: "error", text: "Network error — nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  const f = "rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm";
  return (
    <form onSubmit={submit} method="post" className="flex flex-wrap items-end gap-2" aria-label={`Adjust stock for ${sku}`} data-testid="inventory-adjust">
      <div className="grid gap-1 text-xs">
        <label htmlFor={`${id}-mode`}>Change</label>
        <select id={`${id}-mode`} value={mode} onChange={(e) => setMode(e.target.value as "delta" | "set")} className={f}>
          <option value="delta">Add / remove (+/−)</option>
          <option value="set">Set counted quantity</option>
        </select>
      </div>
      <div className="grid gap-1 text-xs">
        <label htmlFor={`${id}-amount`}>{mode === "set" ? "Counted" : "Units (+/−)"}</label>
        <input id={`${id}-amount`} type="number" step={1} min={mode === "set" ? 0 : undefined} value={amount} onChange={(e) => setAmount(e.target.value)} required className={`${f} w-24`} />
      </div>
      <div className="grid gap-1 text-xs">
        <label htmlFor={`${id}-reason`}>Reason</label>
        <select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={f}>
          {INVENTORY_REASONS.map((r) => (
            <option key={r} value={r}>
              {INVENTORY_REASON_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-[140px] flex-1 gap-1 text-xs">
        <label htmlFor={`${id}-note`}>Note (optional)</label>
        <input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={f} />
      </div>
      <button type="submit" disabled={busy} className="rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
      {msg ? (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`basis-full text-xs ${msg.kind === "error" ? "text-[var(--adm-danger)]" : "text-[var(--adm-success)]"}`}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
