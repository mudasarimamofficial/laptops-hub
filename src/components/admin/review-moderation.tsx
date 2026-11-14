"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTIONS = [
  ["approved", "Approve"],
  ["rejected", "Reject"],
  ["pending", "Back to queue"],
] as const;

/** Approve / reject a review. The customer's text is shown as written and is never edited. */
export function ReviewModeration({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || json.error || `Failed (${res.status})`);
        return;
      }
      setCurrent(json.status);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        aria-label="Moderation note (staff only)"
        placeholder="Note (staff only, optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        className="min-w-0 flex-1 rounded-xl border border-[var(--lh-border)] px-3 py-1.5"
      />
      {ACTIONS.map(([v, l]) => (
        <button
          key={v}
          type="button"
          disabled={busy}
          aria-pressed={current === v}
          onClick={() => change(v)}
          className={`rounded-full border px-3 py-1 ${current === v ? "border-[var(--lh-action)] bg-[var(--lh-ice)] font-semibold" : "border-[var(--lh-border)] bg-white"}`}
        >
          {l}
        </button>
      ))}
      {error ? <span role="alert" className="text-[var(--lh-error)]">{error}</span> : null}
    </div>
  );
}
