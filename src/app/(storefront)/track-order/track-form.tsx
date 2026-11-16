"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

export function TrackOrderForm() {
  const router = useRouter();
  // Before hydration the submit stays disabled (and forms post): a click can never become a GET page reload.
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: fd.get("orderNumber"), phone: fd.get("phone") }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setError(json.message || "We could not find that order. Check the order number and phone.");
        return;
      }
      router.push(json.url);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-4" aria-describedby={error ? "track-error" : undefined}>
      <label className="block text-sm">
        Order number
        <input name="orderNumber" required autoComplete="off" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2 uppercase" />
      </label>
      <label className="block text-sm">
        Mobile number used at checkout
        <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="03XXXXXXXXX" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      </label>
      {error ? (
        <p id="track-error" role="alert" className="text-sm text-[var(--lh-error)]">{error}</p>
      ) : null}
      <button type="submit" className="lh-btn lh-btn-primary" disabled={busy || !hydrated}>
        {busy ? "Looking up…" : "Find my order"}
      </button>
    </form>
  );
}
