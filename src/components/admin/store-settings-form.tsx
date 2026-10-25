"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Props = {
  initial: {
    businessName: string;
    supportEmail: string;
    supportPhone: string;
    inventoryDefaultTracked: boolean;
    lowStockDefault: number;
    seoTitleSuffix: string;
  };
};

export function StoreSettingsForm({ initial }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail);
  const [supportPhone, setSupportPhone] = useState(initial.supportPhone);
  const [inventoryDefaultTracked, setInventoryDefaultTracked] = useState(initial.inventoryDefaultTracked);
  const [lowStockDefault, setLowStockDefault] = useState(String(initial.lowStockDefault));
  const [seoTitleSuffix, setSeoTitleSuffix] = useState(initial.seoTitleSuffix);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          supportEmail,
          supportPhone,
          inventoryDefaultTracked,
          lowStockDefault: Number(lowStockDefault) || 0,
          seoTitleSuffix,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Store settings saved.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Business identity</h2>
      <p className="text-sm text-[var(--adm-ink-2)]">
        Ordinary merchant settings. Production COD release switches and infrastructure secrets stay outside this form.
      </p>
      <label className="block text-sm">
        Business name
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          Support email
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Support phone
          <input
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
          />
        </label>
      </div>
      <h3 className="pt-2 font-semibold">Inventory defaults</h3>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={inventoryDefaultTracked}
          onChange={(e) => setInventoryDefaultTracked(e.target.checked)}
        />
        New products default to tracked inventory
      </label>
      <label className="block text-sm">
        Default low-stock threshold
        <input
          type="number"
          min={0}
          className="mt-1 w-40 rounded-lg border border-[var(--adm-border)] px-3 py-2"
          value={lowStockDefault}
          onChange={(e) => setLowStockDefault(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        SEO title suffix
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
          value={seoTitleSuffix}
          onChange={(e) => setSeoTitleSuffix(e.target.value)}
          placeholder=" | Laptops HUB"
        />
      </label>
      <button
        type="submit"
        disabled={!hydrated || busy}
        className="rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
      {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </form>
  );
}
