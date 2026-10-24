"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PK_PROVINCES } from "@/lib/commerce/pk-places";
import { formatPkr } from "@/lib/money";
import { useHydrated } from "@/lib/ui/use-hydrated";

export type ZoneRow = {
  id: string;
  name: string;
  provinces: string[];
  cities: string[];
  flat_fee_paisa: number;
  cod_fee_paisa: number;
  is_active: boolean;
  notes: string;
};

const field = "rounded-xl border border-[var(--lh-border)] px-3 py-2";

/** What staff see after a save: the stored row, never the values that were typed. */
function savedText(z: ZoneRow) {
  const where = [z.provinces.join(", "), z.cities.length ? "cities: " + z.cities.join(", ") : "whole province"].join(" · ");
  return `Saved: ${z.name} — ${where} — delivery ${formatPkr(z.flat_fee_paisa)}, COD fee ${formatPkr(z.cod_fee_paisa)} — ${z.is_active ? "active" : "not active"}.`;
}

function failureText(status: number, json: { error?: string; message?: string }) {
  if (status === 401) return "Your session has expired. Sign in again, then save the zone.";
  if (status === 403) return "Your role cannot change shipping zones (owner, admin or manager only).";
  if (status === 400) return json.message || "Some zone details were not accepted.";
  if (status === 404) return json.message || "This zone no longer exists.";
  return json.message || `The zone could not be saved (error ${status}). Nothing was changed.`;
}

/** Create (no `zone`) or edit a shipping zone. Provinces come from the same list checkout uses. */
export function ShippingZoneForm({ zone }: { zone?: ZoneRow }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const provinces = fd.getAll("provinces").map(String);
    if (!provinces.length) {
      setError("Select at least one province.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(zone ? `/api/admin/shipping-zones/${zone.id}` : "/api/admin/shipping-zones", {
        method: zone ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          provinces,
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
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; zone?: ZoneRow; error?: string; message?: string };
      if (!res.ok || !json.ok || !json.zone) {
        setError(failureText(res.status, json));
        return;
      }
      setSaved(savedText(json.zone));
      if (!zone) form.reset();
      router.refresh();
    } catch {
      setError("No connection to the server — the zone was not saved. Check your internet connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const idp = zone ? `z-${zone.id}` : "z-new";
  return (
    <form method="post" onSubmit={onSubmit} className="grid max-w-xl gap-3 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5" aria-label={zone ? `Edit ${zone.name}` : "Add shipping zone"}>
      {zone ? null : <h2 className="font-semibold">Add shipping zone</h2>}
      <label className="grid gap-1 text-sm">
        Zone name (shown to customers)
        <input name="name" required defaultValue={zone?.name} className={field} />
      </label>
      <fieldset className="text-sm">
        <legend>Provinces served</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {PK_PROVINCES.map((p) => (
            <label key={p} className="flex items-center gap-2">
              <input type="checkbox" name="provinces" value={p} defaultChecked={zone?.provinces.some((x) => x.toLowerCase() === p.toLowerCase())} />
              {p}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm">
        Cities (comma-separated; leave empty to serve the whole selected provinces)
        <input name="cities" defaultValue={zone?.cities.join(", ")} placeholder="e.g. Lahore, Rawalpindi" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm" htmlFor={`${idp}-fee`}>
          Delivery fee (PKR)
          <input id={`${idp}-fee`} name="flatFeePkr" type="number" min={0} step={1} required defaultValue={zone ? zone.flat_fee_paisa / 100 : ""} className={field} />
        </label>
        <label className="grid gap-1 text-sm" htmlFor={`${idp}-cod`}>
          COD fee (PKR)
          <input id={`${idp}-cod`} name="codFeePkr" type="number" min={0} step={1} required defaultValue={zone ? zone.cod_fee_paisa / 100 : ""} className={field} />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Note shown at checkout (courier, delivery time)
        <input name="notes" defaultValue={zone?.notes} maxLength={500} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={zone?.is_active} /> Active (customers can choose it)
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[var(--lh-error)]">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-[var(--lh-success)]">
          {saved}
        </p>
      ) : null}
      <button type="submit" className="lh-btn lh-btn-primary" disabled={pending || !hydrated}>
        {pending ? "Saving…" : zone ? "Save changes" : "Add zone"}
      </button>
    </form>
  );
}
