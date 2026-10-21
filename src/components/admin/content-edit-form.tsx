"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  title: string;
  status: "pending" | "draft" | "published";
  bodyHtml: string;
};

export function ContentEditForm(props: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(props.title);
  const [status, setStatus] = useState(props.status);
  const [bodyHtml, setBodyHtml] = useState(props.bodyHtml);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/content/${encodeURIComponent(props.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, bodyHtml }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Saved.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-mono)] text-sm font-semibold uppercase tracking-wider">{props.slug}</h2>
        <span className="text-xs text-[var(--lh-ink-2)]">{props.status}</span>
      </div>
      <label className="mt-4 block text-sm">
        <span className="font-medium">Title</span>
        <input
          className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="font-medium">Status</span>
        <select
          className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as Props["status"])}
        >
          <option value="pending">Pending (not public)</option>
          <option value="draft">Draft (not public)</option>
          <option value="published">Published</option>
        </select>
      </label>
      <label className="mt-3 block text-sm">
        <span className="font-medium">Body (HTML — keep simple; no scripts)</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs"
          rows={8}
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
        />
      </label>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-2 text-sm text-emerald-700">{msg}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save page"}
      </button>
    </form>
  );
}
