"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShippingZoneForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/shipping-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        provinces: String(fd.get("provinces") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        cities: String(fd.get("cities") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        flatFeePkr: Number(fd.get("flatFeePkr") || 0),
        codFeePkr: Number(fd.get("codFeePkr") || 0),
        isActive: fd.get("isActive") === "on",
        notes: fd.get("notes") || "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(json.message || json.error || "Failed");
      return;
    }
    setOk(true);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-3 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5">
      <h2 className="font-semibold">Add shipping zone</h2>
      <p className="text-xs text-[var(--lh-ink-2)]">
        Provinces required. Cities optional (empty = entire listed provinces). Fees in PKR major units.
      </p>
      <input name="name" required placeholder="Zone name" className="rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      <input
        name="provinces"
        required
        placeholder="Provinces (comma-separated), e.g. Punjab, Sindh"
        className="rounded-xl border border-[var(--lh-border)] px-3 py-2"
      />
      <input
        name="cities"
        placeholder="Cities (comma-separated), e.g. Lahore, Karachi"
        className="rounded-xl border border-[var(--lh-border)] px-3 py-2"
      />
      <div className="grid grid-cols-2 gap-3">
        <input name="flatFeePkr" type="number" min={0} step={1} defaultValue={0} placeholder="Delivery fee PKR" className="rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        <input name="codFeePkr" type="number" min={0} step={1} defaultValue={0} placeholder="COD fee PKR" className="rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      </div>
      <input name="notes" placeholder="Notes (optional)" className="rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" /> Active (only active zones are quotable)
      </label>
      {error ? <p className="text-sm text-[var(--lh-error)]">{error}</p> : null}
      {ok ? <p className="text-sm text-[var(--lh-success)]">Zone saved.</p> : null}
      <button type="submit" className="lh-btn lh-btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save zone"}
      </button>
    </form>
  );
}
