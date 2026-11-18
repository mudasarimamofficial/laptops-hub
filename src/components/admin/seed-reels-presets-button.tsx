"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

/** Seeds the six Generation Laptops HUB preset drafts by stable preset_key (never overwrites existing). */
export function SeedReelsPresetsButton() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    if (
      !window.confirm(
        "Add the six Generation Laptops HUB reference presets if missing? They stay drafts. Existing presets and merchant-edited reels are not overwritten.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reels/seed-presets", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.message || "Seed failed");
        return;
      }
      const invalid = Array.isArray(data.results)
        ? data.results.filter((r: { action?: string }) => r.action === "skipped_invalid").length
        : 0;
      setMsg(
        `Added ${data.inserted || 0}, skipped ${data.skipped || 0}${invalid ? ` (${invalid} invalid)` : ""}. Drafts only — confirm rights before publish.`,
      );
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={!hydrated || busy}
        onClick={() => void onClick()}
        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--adm-border)] bg-white px-4 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Seeding…" : "Restore 6 presets"}
      </button>
      {msg ? <span className="text-xs text-[var(--adm-ink-2)]">{msg}</span> : null}
    </div>
  );
}
