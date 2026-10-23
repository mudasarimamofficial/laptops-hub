"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationRetry({ orderNumber }: { orderNumber: string }) {
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
      setMsg(res.ok ? `Sent ${json.sent} · failed ${json.failed}` : json.message || json.error || `Failed (${res.status})`);
      router.refresh();
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" onClick={retry} disabled={busy} className="lh-btn lh-btn-ghost text-sm">
        {busy ? "Sending…" : "Retry sending"}
      </button>
      {msg ? <span role="status" className="text-sm text-[var(--lh-ink-2)]">{msg}</span> : null}
    </div>
  );
}
