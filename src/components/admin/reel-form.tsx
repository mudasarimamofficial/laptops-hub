"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminMediaPicker } from "@/components/admin/ui/admin-media-picker";
import { ReelProductPicker } from "@/components/admin/reel-product-picker";

export type ReelFormValues = {
  title: string;
  caption: string;
  mediaSource: "uploaded" | "external_file" | "external_stream";
  videoUrl: string;
  hlsUrl: string;
  posterUrl: string;
  avatarUrl: string;
  productHandle: string;
  productHandles: string[];
  linkPath: string;
  rightsStatus: "pending" | "owned" | "licensed";
  rightsNote: string;
  sourceAttribution: string;
  status: "draft" | "published" | "archived";
  sortOrder: number;
  creatorName: string;
  creatorConsent: boolean;
  tag: string;
  presetKey: string;
};

export const EMPTY_REEL: ReelFormValues = {
  title: "",
  caption: "",
  mediaSource: "external_file",
  videoUrl: "",
  hlsUrl: "",
  posterUrl: "",
  avatarUrl: "",
  productHandle: "",
  productHandles: [],
  linkPath: "",
  rightsStatus: "pending",
  rightsNote: "",
  sourceAttribution: "",
  status: "draft",
  sortOrder: 0,
  creatorName: "",
  creatorConsent: false,
  tag: "",
  presetKey: "",
};

const input = "mt-1 w-full min-w-0 rounded-lg border border-[var(--adm-border)] bg-white px-3 py-2";

/** Create or edit one reel. Publishing is refused until rights are confirmed — independent of media host. */
export function ReelForm({ id, initial }: { id?: string; initial: ReelFormValues }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<ReelFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = <K extends keyof ReelFormValues>(k: K, val: ReelFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const fieldErr = (k: string) =>
    fe[k] ? (
      <span role="alert" className="mt-1 block text-xs text-[var(--adm-danger)]">
        {fe[k]}
      </span>
    ) : null;

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
        <span className="font-medium">Media source</span>
        <select
          className={input}
          value={v.mediaSource}
          onChange={(e) => set("mediaSource", e.target.value as ReelFormValues["mediaSource"])}
        >
          <option value="uploaded">Uploaded file (Laptops HUB storage URL)</option>
          <option value="external_file">External video URL (HTTPS MP4 / WebM / MOV)</option>
          <option value="external_stream">External streaming URL (HLS .m3u8 + MP4 fallback)</option>
        </select>
        <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">
          Use a direct HTTPS media file. External hosts are allowed. Hotlinking may fail if the remote server blocks it — preview below to check.
        </span>
      </label>

      <label className="block sm:col-span-2">
        <span className="font-medium">Video URL (MP4 / WebM / MOV)</span>
        <input
          className={input}
          type="url"
          inputMode="url"
          value={v.videoUrl}
          onChange={(e) => set("videoUrl", e.target.value)}
          required
          placeholder="https://…/reel.mp4"
        />
        {fieldErr("videoUrl")}
      </label>

      <label className="block sm:col-span-2">
        <span className="font-medium">HLS URL (optional .m3u8)</span>
        <input
          className={input}
          type="url"
          inputMode="url"
          value={v.hlsUrl}
          onChange={(e) => set("hlsUrl", e.target.value)}
          placeholder="https://…/reel.m3u8"
        />
        <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">
          Used when the browser supports HLS; MP4 remains the fallback. Not all CDNs allow cross-origin streaming.
        </span>
        {fieldErr("hlsUrl")}
      </label>

      {v.videoUrl ? (
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium">Preview</p>
          <video
            key={v.videoUrl}
            controls
            playsInline
            preload="metadata"
            poster={v.posterUrl || undefined}
            className="max-h-80 w-full rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-black"
            src={v.videoUrl}
          >
            {v.hlsUrl ? <source src={v.hlsUrl} type="application/x-mpegURL" /> : null}
            <source src={v.videoUrl} />
          </video>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
            If preview fails, the remote file may be missing, blocked for hotlinking, or an unsupported format — not because of the domain name alone.
          </p>
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <AdminMediaPicker
          label="Poster / cover image (optional)"
          value={v.posterUrl}
          onChange={(url) => set("posterUrl", url)}
          hint="Optional. When empty, the live video frame is used on the storefront. Upload, pick from library, or paste an HTTPS image URL."
        />
        {fieldErr("posterUrl")}
      </div>

      <label className="block sm:col-span-2">
        <span className="font-medium">Avatar image URL (optional)</span>
        <input
          className={input}
          type="url"
          inputMode="url"
          value={v.avatarUrl}
          onChange={(e) => set("avatarUrl", e.target.value)}
          placeholder="https://…/avatar.jpg"
        />
        {fieldErr("avatarUrl")}
      </label>

      <ReelProductPicker
        value={v.productHandles}
        onChange={(handles) => {
          set("productHandles", handles);
          set("productHandle", handles[0] || "");
        }}
        error={fe.productHandles || fe.productHandle}
      />
      <label className="block sm:col-span-2">
        <span className="font-medium">Fallback browse path (optional)</span>
        <input
          className={input}
          value={v.linkPath}
          onChange={(e) => set("linkPath", e.target.value.trim())}
          placeholder="/collections/all"
        />
        <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">
          Used in the shoppable popup when no products are linked.
        </span>
        {fieldErr("linkPath")}
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
        <select
          className={input}
          value={v.rightsStatus === "pending" && v.status === "published" ? "draft" : v.status}
          onChange={(e) => set("status", e.target.value as ReelFormValues["status"])}
        >
          <option value="draft">Draft (not public)</option>
          <option value="published" disabled={v.rightsStatus === "pending"}>
            {v.rightsStatus === "pending" ? "Published (confirm rights first)" : "Published"}
          </option>
          <option value="archived">Archived (not public)</option>
        </select>
        {v.rightsStatus === "pending" ? (
          <span className="mt-1 block text-xs text-amber-800">
            Publishing stays disabled until rights are Owned or Licensed. An external URL alone is not permission.
          </span>
        ) : null}
      </label>

      <label className="block sm:col-span-2">
        <span className="font-medium">Rights note</span>
        <input
          className={input}
          value={v.rightsNote}
          onChange={(e) => set("rightsNote", e.target.value)}
          maxLength={500}
          placeholder="Who licensed it, date, terms"
        />
        {fieldErr("rightsNote")}
      </label>
      <label className="block sm:col-span-2">
        <span className="font-medium">Source / attribution note</span>
        <input
          className={input}
          value={v.sourceAttribution}
          onChange={(e) => set("sourceAttribution", e.target.value)}
          maxLength={500}
          placeholder="Where the media came from (for staff)"
        />
      </label>

      <label className="block">
        <span className="font-medium">Creator display name (optional)</span>
        <input
          className={input}
          value={v.creatorName}
          onChange={(e) => set("creatorName", e.target.value)}
          maxLength={80}
          placeholder="Shown on the reel"
        />
        {fieldErr("creatorName")}
      </label>
      <label className="block">
        <span className="font-medium">Tag (optional)</span>
        <input className={input} value={v.tag} onChange={(e) => set("tag", e.target.value.trim())} maxLength={40} placeholder="#Productivity" />
        {fieldErr("tag")}
      </label>
      <label className="flex items-start gap-2 sm:col-span-2">
        <input type="checkbox" className="mt-1" checked={v.creatorConsent} onChange={(e) => set("creatorConsent", e.target.checked)} />
        <span>
          The person named above agreed in writing to be shown on the Laptops HUB website. Never name a creator without
          permission, and never suggest an endorsement they did not give.
          {fieldErr("creatorConsent")}
        </span>
      </label>
      <label className="block">
        <span className="font-medium">Order (lower shows first)</span>
        <input
          className={input}
          type="number"
          min={-1000}
          max={1000}
          value={v.sortOrder}
          onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
        />
      </label>
      {v.presetKey ? (
        <p className="sm:col-span-2 text-xs text-[var(--adm-ink-2)]">
          Preset key: <code className="font-[family-name:var(--font-mono)]">{v.presetKey}</code> (stable import id)
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={!hydrated || busy}
          className="rounded-lg bg-[var(--adm-action,#1748B5)] px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          {id ? "Save reel" : "Add reel"}
        </button>
        {id ? (
          <button
            type="button"
            disabled={!hydrated || busy}
            onClick={onDelete}
            className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-4 py-2"
          >
            Delete
          </button>
        ) : null}
        {err ? <p role="alert" className="text-[var(--adm-danger)]">{err}</p> : null}
        {msg ? <p role="status" className="text-[var(--adm-success)]">{msg}</p> : null}
      </div>
    </form>
  );
}
