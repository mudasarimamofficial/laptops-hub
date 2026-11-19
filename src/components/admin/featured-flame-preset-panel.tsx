"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import type { FeaturedFlamePreset } from "@/lib/content/featured-flame-preset";
import { MerchBadgePill } from "@/components/storefront/merch-badges";

const input = "mt-1 w-full min-w-0 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2";

/** Merchant controls for the default 🔥 Featured flame preset. */
export function FeaturedFlamePresetPanel({
  initial,
  productCount,
  exampleHandles,
}: {
  initial: FeaturedFlamePreset;
  productCount: number;
  exampleHandles: string[];
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [preset, setPreset] = useState(initial);
  const [label, setLabel] = useState(initial.label);
  const [icon, setIcon] = useState<"flame" | "star">(initial.icon);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/featured-flame-preset", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `Action failed (${res.status})`);
        return;
      }
      if (data.preset) {
        setPreset(data.preset);
        setLabel(data.preset.label);
        setIcon(data.preset.icon);
      }
      setMsg(
        action === "restore"
          ? `Defaults restored (${(data.addedHandles || []).length} products).`
          : action === "clear"
            ? "Preset badges cleared. Removed products will not auto-return."
            : action === "enable"
              ? "Flame badges enabled on the storefront."
              : action === "disable"
                ? "Flame badges hidden on the storefront."
                : action === "update"
                  ? "Label and icon saved."
                  : "Preset ready.",
      );
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="flame-preset"
      className="mb-6 space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
      data-testid="featured-flame-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="flame-preset" className="text-base font-semibold">
            🔥 Featured flame badges
          </h2>
          <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
            Editorial merchandising label only — never a sales claim. Top Seller stays data-backed and separate.
          </p>
        </div>
        <MerchBadgePill badge={{ kind: "featured", label: label || "Featured", icon }} />
      </div>

      <ul className="space-y-1 text-sm text-[var(--adm-ink-2)]">
        <li>
          Status:{" "}
          <strong className="text-[var(--adm-ink)]" data-testid="flame-enabled">
            {preset.enabled ? "Enabled" : "Disabled"}
          </strong>
          {preset.installedAt ? ` · installed ${new Date(preset.installedAt).toLocaleString("en-PK")}` : " · not installed yet"}
        </li>
        <li>
          Products with preset badge:{" "}
          <strong className="text-[var(--adm-ink)]" data-testid="flame-product-count">
            {productCount}
          </strong>
          {exampleHandles.length ? ` — ${exampleHandles.slice(0, 6).join(", ")}` : ""}
        </li>
        <li>
          Merchant-removed (won&apos;t auto-return):{" "}
          <strong className="text-[var(--adm-ink)]">{preset.suppressedProductIds.length}</strong>
        </li>
      </ul>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="block">
          Display label
          <input className={input} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block">
          Icon
          <select className={input} value={icon} onChange={(e) => setIcon(e.target.value as "flame" | "star")}>
            <option value="flame">🔥 Flame</option>
            <option value="star">★ Star</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!hydrated || busy}
          className="rounded-full bg-[var(--adm-accent,#2159D4)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => run("update", { label, icon })}
        >
          Save label &amp; icon
        </button>
        <button
          type="button"
          disabled={!hydrated || busy}
          className="rounded-full border border-[var(--adm-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={() => run(preset.enabled ? "disable" : "enable")}
        >
          {preset.enabled ? "Disable flame badges" : "Enable flame badges"}
        </button>
        <button
          type="button"
          disabled={!hydrated || busy}
          className="rounded-full border border-[var(--adm-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={() => {
            if (!window.confirm("Restore sensible 🔥 Featured defaults on eligible products? Merchant-removed products stay suppressed unless you also clear suppressions."))
              return;
            void run("restore", { clearSuppressed: false });
          }}
        >
          Restore defaults
        </button>
        <button
          type="button"
          disabled={!hydrated || busy}
          className="rounded-full border border-[var(--adm-danger,#b42318)] px-4 py-2 text-sm font-semibold text-[var(--adm-danger,#b42318)] disabled:opacity-50"
          onClick={() => {
            if (!window.confirm("Clear all preset 🔥 Featured badges? Removed products will not auto-return on deploy.")) return;
            void run("clear");
          }}
        >
          Clear preset badges
        </button>
      </div>

      {err ? (
        <p role="alert" className="text-sm text-[var(--adm-danger,#b42318)]">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="text-sm text-emerald-700">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
