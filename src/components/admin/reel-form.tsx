"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

export type ReelFormValues = {
  title: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  productHandle: string;
  rightsStatus: "pending" | "owned" | "licensed";
  rightsNote: string;
  status: "draft" | "published" | "archived";
  sortOrder: number;
};

export const EMPTY_REEL: ReelFormValues = {
  title: "",
  caption: "",
  videoUrl: "",
  posterUrl: "",
  productHandle: "",
  rightsStatus: "pending",
  rightsNote: "",
  status: "draft",
  sortOrder: 0,
};

const input = "mt-1 w-full min-w-0 rounded-xl border border-[var(--lh-border)] px-3 py-2";

/** Create or edit one reel. Publishing is refused (here, in the API and in the DB) until rights are confirmed. */
export function ReelForm({ id, initial }: { id?: string; initial: ReelFormValues }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<ReelFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = <K extends keyof ReelFormValues>(k: K, val: ReelFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const fieldErr = (k: string) => (fe[k] ? <span role="alert" className="mt-1 block text-xs text-[var(--lh-error)]">{fe[k]}</span> : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    setFe({});
    try {
      const res = await fetch(id ? `/api/admin/reels/${id}` : "/api/admin/reels", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFe(data.fieldErrors || {});
        setErr(data.message || `Save failed (${res.status})`);
        return;
      }
      setMsg("Reel saved.");
      if (!id) setV(EMPTY_REEL);
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id || !window.confirm("Delete this reel? The video file itself is not deleted.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/reels/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr(`Delete failed (${res.status})`);
  }

  return (
    <form method="post" onSubmit={onSubmit} data-testid={id ? "reel-edit-form" : "reel-new-form"} className="grid gap-3 text-sm sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="font-medium">Title</span>
        <input className={input} value={v.title} onChange={(e) => set("title", e.target.value)} required maxLength={120} />
        {fieldErr("title")}
      </label>
      <label className="block sm:col-span-2">
        <span className="font-medium">Caption (optional)</span>
        <input className={input} value={v.caption} onChange={(e) => set("caption", e.target.value)} maxLength={300} />
      </label>
      <label className="block sm:col-span-2">
        <span className="font-medium">Video file link</span>
        <input className={input} type="url" inputMode="url" value={v.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} required placeholder="https://…/reel.mp4" />
        <span className="mt-1 block text-xs text-[var(--lh-ink-2)]">Direct .mp4, .webm or .mov file that Laptops HUB owns or has licensed. Videos from other shops cannot be used.</span>
        {fieldErr("videoUrl")}
      </label>
      <label className="block">
        <span className="font-medium">Cover image link (optional)</span>
        <input className={input} type="url" inputMode="url" value={v.posterUrl} onChange={(e) => set("posterUrl", e.target.value)} placeholder="https://…/cover.webp" />
        {fieldErr("posterUrl")}
      </label>
      <label className="block">
        <span className="font-medium">Linked product handle (optional)</span>
        <input className={input} value={v.productHandle} onChange={(e) => set("productHandle", e.target.value.trim())} placeholder="dell-latitude-7490" />
        {fieldErr("productHandle")}
      </label>
      <label className="block">
        <span className="font-medium">Video rights</span>
        <select className={input} value={v.rightsStatus} onChange={(e) => set("rightsStatus", e.target.value as ReelFormValues["rightsStatus"])}>
          <option value="pending">Not confirmed yet</option>
          <option value="owned">Owned by Laptops HUB (we filmed it)</option>
          <option value="licensed">Licensed (permission in writing)</option>
        </select>
        {fieldErr("rightsStatus")}
      </label>
      <label className="block">
        <span className="font-medium">Status</span>
        <select className={input} value={v.status} onChange={(e) => set("status", e.target.value as ReelFormValues["status"])}>
          <option value="draft">Draft (not public)</option>
          <option value="published">Published</option>
          <option value="archived">Archived (not public)</option>
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="font-medium">Rights note</span>
        <input className={input} value={v.rightsNote} onChange={(e) => set("rightsNote", e.target.value)} maxLength={500} placeholder="Who licensed it, date, terms" />
        {fieldErr("rightsNote")}
      </label>
      <label className="block">
        <span className="font-medium">Order (lower shows first)</span>
        <input className={input} type="number" min={-1000} max={1000} value={v.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
      </label>
      <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
        <button type="submit" disabled={!hydrated || busy} className="rounded-full bg-[var(--lh-action)] px-5 py-2 font-semibold text-white disabled:opacity-50">
          {id ? "Save reel" : "Add reel"}
        </button>
        {id ? (
          <button type="button" disabled={!hydrated || busy} onClick={onDelete} className="rounded-full border border-[var(--lh-border)] px-4 py-2">
            Delete
          </button>
        ) : null}
        {err ? <p role="alert" className="text-[var(--lh-error)]">{err}</p> : null}
        {msg ? <p role="status" className="text-emerald-700">{msg}</p> : null}
      </div>
    </form>
  );
}
