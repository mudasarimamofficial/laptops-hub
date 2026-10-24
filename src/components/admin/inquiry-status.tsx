"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = [
  ["new", "New"],
  ["open", "Being handled"],
  ["closed", "Closed"],
] as const;

/** Inquiry status control; shows the server-confirmed status after saving. */
export function InquiryStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Failed (${res.status})`);
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
      <span className="text-[var(--lh-ink-2)]">Status:</span>
      {STATUSES.map(([v, l]) => (
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
