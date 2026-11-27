"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Retry sending" for an order's notifications. The page keeps it mounted even when nothing is pending, so the result
 * of a successful retry ("Accepted 1 · failed 0") is still shown after the page refreshes and the button disappears.
 */
export function NotificationRetry({
  orderNumber,
  pending = true,
}: {
  orderNumber: string;
  pending?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/notifications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg(
        res.ok
          ? json.processed === 0
            ? "Nothing to send (already accepted, or being sent right now)."
            : `Accepted ${json.accepted} · failed ${json.failed}${json.lost ? ` · taken over ${json.lost}` : ""}`
          : json.message || json.error || `Failed (${res.status})`,
      );
      router.refresh();
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!pending && !msg) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {pending ? (
        <button
          type="button"
          onClick={retry}
          disabled={busy}
          className="lh-btn lh-btn-ghost text-sm"
        >
          {busy ? "Sending…" : "Retry sending"}
        </button>
      ) : null}
      {msg ? (
        <span role="status" className="text-sm text-[var(--lh-ink-2)]">
          {msg}
        </span>
      ) : null}
    </div>
  );
}
