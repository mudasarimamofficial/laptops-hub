"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

export type MediaRow = {
  id: string;
  url: string;
  alt: string;
  position: number;
  approval?: string;
};

type Props = {
  handle: string;
  initialMedia: MediaRow[];
};

export function ProductMediaManager({ handle, initialMedia }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [media, setMedia] = useState(initialMedia);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refreshFromServer() {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}/media`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.media)) {
      setMedia(
        data.media.map((m: MediaRow) => ({
          id: m.id,
          url: m.url,
          alt: m.alt,
          position: m.position,
          approval: m.approval,
        })),
      );
    }
    router.refresh();
  }

  async function addMedia(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          alt: alt.trim(),
          origin: url.includes("cdn.shopify.com") ? "source_shopify" : "remote",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Add failed (${res.status})`);
        return;
      }
      setUrl("");
      setAlt("");
      setMsg(data.notice || "Image URL saved. Rights stay pending until owner approval.");
      await refreshFromServer();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMedia(mediaId: string) {
    if (!confirm("Remove this image reference from the product? The remote file is not deleted from its host.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Delete failed (${res.status})`);
        return;
      }
      setMsg("Image reference removed.");
      await refreshFromServer();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function move(mediaId: string, dir: -1 | 1) {
    const sorted = [...media].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((m) => m.id === mediaId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const orderedIds = next.map((m) => m.id);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}/media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.message || "Reorder failed");
        return;
      }
      await refreshFromServer();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Media</h2>
      <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
        Paste authorized HTTPS image URLs (including Shopify CDN). We store the URL reference — we do not download or
        rehost unless you later approve that. Public CDN ≠ usage rights.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...media]
          .sort((a, b) => a.position - b.position)
          .map((m, i) => (
            <li key={m.id} className="rounded-lg border border-[var(--adm-border)] p-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[var(--adm-surface-2)]">
                <Image src={m.url} alt={m.alt || ""} fill className="object-contain" sizes="240px" unoptimized />
              </div>
              <p className="mt-2 truncate text-xs text-[var(--adm-ink-2)]" title={m.url}>
                #{m.position} {m.approval === "pending" ? "· rights pending" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!hydrated || busy || i === 0}
                  onClick={() => move(m.id, -1)}
                  className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={!hydrated || busy || i === media.length - 1}
                  onClick={() => move(m.id, 1)}
                  className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  disabled={!hydrated || busy}
                  onClick={() => removeMedia(m.id)}
                  className="rounded border border-[var(--adm-danger)] px-2 py-1 text-xs font-semibold text-[var(--adm-danger)] disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
      </ul>

      <form method="post" onSubmit={addMedia} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Image URL (HTTPS)</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://cdn.shopify.com/..."
            required
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Alt text</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!hydrated || busy}
            className="w-full rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add URL
          </button>
        </div>
      </form>

      {msg ? <p className="mt-3 text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
