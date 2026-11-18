"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

/** Seeds the six Generation Laptops HUB preset drafts without overwriting existing titles. */
export function SeedReelsPresetsButton() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    if (!window.confirm("Add the six preset draft reels (if missing)? Nothing is published. Blocked third-party media stays unpublished until you replace it.")) {
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
      setMsg(`Added ${data.inserted || 0}, skipped ${data.skipped || 0} existing.`);
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
