"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

type BackupRow = {
  id: string;
  label: string;
  kind: string;
  status: string;
  payload_bytes: number;
  created_at: string;
  verified_at: string | null;
  notes: string | null;
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Admin → Settings → Backups & Recovery. Owner/admin create; owner restores. */
export function BackupsPanel({ canRestore }: { canRestore: boolean }) {
  const hydrated = useHydrated();
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/backups", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.message || "Could not load backups");
      return;
    }
    setRows(data.backups || []);
  }

  useEffect(() => {
    // Initial list fetch for the admin panel (external system → React state).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot remote load on mount
    void load();
  }, []);

  async function createBackup() {
    setBusy("create");
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `Manual backup ${new Date().toLocaleString("en-PK")}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || "Backup failed");
        return;
      }
      setMsg(data.backup?.status === "valid" ? "Backup created and verified. Up to four recent valid backups are kept." : "Backup recorded but failed validation — older valid backups were not removed.");
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function restore(id: string, label: string) {
    if (!canRestore) return;
    const ok = window.confirm(
      `Restore “${label}”? This overwrites products settings, articles, reels, reviews and shipping zones from the backup. Orders and staff accounts are not changed. A pre-restore checkpoint is created first.`,
    );
    if (!ok) return;
    setBusy(id);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/backups/${id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || "Restore failed");
        return;
      }
      setMsg("Restore completed. Review the storefront and admin catalog.");
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  const valid = rows.filter((r) => r.status === "valid").slice(0, 4);
  const last = valid[0];

  return (
    <section
      id="backups-recovery"
      className="mt-10 scroll-mt-24 space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Backups &amp; Recovery</h2>
        <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
          Automatic merchant-data snapshots protect settings, catalog, blog, reels, reviews and shipping. The latest four
          valid backups are kept. This is not a full database disaster-recovery dump.
        </p>
      </div>
      <p className="text-sm" aria-live="polite">
        Last successful backup:{" "}
        {last ? (
          <strong>
            {new Date(last.created_at).toLocaleString("en-PK")} · {fmtBytes(last.payload_bytes)} · {last.status}
          </strong>
        ) : (
          <strong>None yet</strong>
        )}
      </p>
      <button
        type="button"
        disabled={!hydrated || busy !== null}
        onClick={() => void createBackup()}
        className="rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy === "create" ? "Creating backup…" : "Create backup now"}
      </button>
      {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
      <ul className="divide-y divide-[var(--adm-border)] rounded-lg border border-[var(--adm-border)]">
        {rows.length === 0 ? (
          <li className="p-4 text-sm text-[var(--adm-ink-2)]">No backups yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{r.label}</p>
                <p className="text-xs text-[var(--adm-ink-2)]">
                  {new Date(r.created_at).toLocaleString("en-PK")} · {r.kind} · {r.status} · {fmtBytes(r.payload_bytes)}
                </p>
              </div>
              {canRestore && r.status === "valid" ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void restore(r.id, r.label)}
                  className="rounded-lg border border-[var(--adm-danger,#b91c1c)] px-3 py-1.5 text-xs font-semibold text-[var(--adm-danger,#b91c1c)] disabled:opacity-50"
                >
                  {busy === r.id ? "Restoring…" : "Restore"}
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
