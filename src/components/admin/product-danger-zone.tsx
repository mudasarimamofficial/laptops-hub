"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Props = { handle: string; title: string; status: string };

export function ProductDangerZone({ handle, title, status }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function archiveOrDelete(mode: "archive" | "soft_delete") {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, confirmHandle: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Failed (${res.status})`);
        return;
      }
      setMsg(mode === "archive" ? "Product archived." : data.message || "Product soft-deleted (restorable).");
      router.push("/admin/products?status=archived");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || "Restore failed");
        return;
      }
      setMsg("Restored as draft.");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-[var(--adm-radius-lg)] border border-[var(--adm-danger)]/40 bg-[var(--adm-danger-bg)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--adm-danger)]">Danger zone</h2>
      <p className="mt-1 text-sm text-[var(--adm-ink)]">
        Archiving or soft-deleting <strong>{title}</strong> hides it from the storefront. Historical orders keep their
        line-item snapshots. Hard delete is refused when order history or constraints require retention.
      </p>

      {status === "archived" ? (
        <button
          type="button"
          disabled={!hydrated || busy}
          onClick={restore}
          className="mt-4 rounded-lg border border-[var(--adm-border)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Restore to draft
        </button>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="font-medium">Type handle to confirm: {handle}</span>
        <input
          className="mt-1 w-full max-w-md rounded-lg border border-[var(--adm-border)] bg-white px-3 py-2 font-[family-name:var(--font-mono)] text-sm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hydrated || busy || confirm !== handle}
          onClick={() => archiveOrDelete("archive")}
          className="rounded-lg border border-[var(--adm-border)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Archive
        </button>
        <button
          type="button"
          disabled={!hydrated || busy || confirm !== handle}
          onClick={() => archiveOrDelete("soft_delete")}
          className="rounded-lg bg-[var(--adm-danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Soft-delete
        </button>
      </div>
      {msg ? <p className="mt-3 text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
