"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { ALT_MAX, isImportedAlt, RIGHTS_LABELS } from "@/lib/catalog/media-order";

export type MediaRow = {
  id: string;
  url: string;
  alt: string;
  position: number;
  approval?: string;
  origin?: string;
  rights_note?: string | null;
  usedByVariants?: string[];
};

type LibraryItem = { id: string; url: string; alt: string | null; label: string; source: "cms" | "product" };

type Props = {
  handle: string;
  productTitle: string;
  initialMedia: MediaRow[];
  /** Owner and admin may record whether the image rights are confirmed. */
  canConfirmRights: boolean;
};

const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const UPLOAD_MAX = 5 * 1024 * 1024;
const btn = "rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40";
const input = "w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm";

/**
 * Product gallery editor (G13). The first image is the primary image: it leads the product page gallery, product
 * cards, the share preview (Open Graph) and the Product structured data.
 */
export function ProductMediaManager({ handle, productTitle, initialMedia, canConfirmRights }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [media, setMedia] = useState<MediaRow[]>(() => [...initialMedia].sort((a, b) => a.position - b.position));
  const [alts, setAlts] = useState<Record<string, string>>(() => Object.fromEntries(initialMedia.map((m) => [m.id, m.alt || ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [newAlt, setNewAlt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [library, setLibrary] = useState<LibraryItem[] | null>(null);
  const [libQuery, setLibQuery] = useState("");
  const api = `/api/admin/products/${encodeURIComponent(handle)}/media`;

  async function reload() {
    const res = await fetch(api, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.media)) {
      const rows = (data.media as MediaRow[]).sort((a, b) => a.position - b.position);
      setMedia(rows);
      setAlts(Object.fromEntries(rows.map((m) => [m.id, m.alt || ""])));
    }
    router.refresh();
  }

  /** Runs one request; shows the server's message on success or failure. */
  async function run(init: RequestInit & { url?: string }, onOk?: () => void) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(init.url || api, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `That did not work (${res.status}). Nothing was changed.`);
        return false;
      }
      onOk?.();
      await reload();
      // Shown only once the list is up to date, together with the buttons becoming available again.
      setMsg(data.message || "Saved.");
      return true;
    } catch {
      setErr("Network error: nothing was changed. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const order = media.map((m) => m.id);
  const move = (id: string, dir: -1 | 1) => {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    void run({ method: "PATCH", body: JSON.stringify({ orderedIds: next }) });
  };

  async function upload() {
    if (!file) return;
    if (!UPLOAD_TYPES.includes(file.type)) return setErr("Use a JPEG, PNG, WebP or GIF image.");
    if (file.size > UPLOAD_MAX) return setErr("The image must be under 5 MB.");
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt", newAlt.trim());
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      const assetId = data.asset?.id || data.id;
      if (!res.ok || !assetId) {
        setErr(data.message || `The upload failed (${res.status}).`);
        return;
      }
      setBusy(false);
      await run({ method: "POST", body: JSON.stringify({ assetId, alt: newAlt }) }, () => {
        setFile(null);
        setFileKey((k) => k + 1);
        setNewAlt("");
      });
    } catch {
      setErr("Network error: the image was not uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function openLibrary() {
    setErr(null);
    const res = await fetch(`/api/admin/media/library?q=${encodeURIComponent(libQuery.trim())}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data.message || "The Media library could not be loaded.");
    setLibrary(((data.items || []) as LibraryItem[]).filter((i) => i.source === "cms"));
  }

  return (
    <section
      data-testid="product-media"
      className="mt-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Images</h2>
      <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
        The first image is the <strong>primary image</strong>: it leads the product page, product cards and the preview shown
        when the page is shared. Describe each image for customers who use screen readers; if you leave it empty, the product
        name is used.
      </p>

      {media.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[var(--adm-surface-2)] p-3 text-sm" data-testid="product-media-empty">
          No images yet. The storefront shows a plain placeholder until you add one.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {media.map((m, i) => (
            <li
              key={m.id}
              data-testid="product-media-item"
              data-media-id={m.id}
              className="grid gap-3 rounded-lg border border-[var(--adm-border)] p-3 sm:grid-cols-[96px_1fr]"
            >
              <div className="relative h-24 w-24 overflow-hidden rounded-md bg-[var(--adm-surface-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="h-full w-full object-contain" loading="lazy" />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">Image {i + 1}</span>
                  {i === 0 ? (
                    <span className="rounded bg-[var(--adm-action)] px-1.5 py-0.5 font-semibold text-white" data-testid="product-media-primary">
                      Primary
                    </span>
                  ) : null}
                  <span className="rounded bg-[var(--adm-surface-2)] px-1.5 py-0.5" data-testid="product-media-rights">
                    {RIGHTS_LABELS[m.approval || "pending"] || m.approval}
                  </span>
                  <span className="text-[var(--adm-ink-2)]">
                    {m.origin === "uploaded" ? "Uploaded to your Media library" : m.origin === "source_shopify" ? "Hosted on Shopify" : "External address"}
                  </span>
                  {m.usedByVariants?.length ? <span className="text-[var(--adm-ink-2)]">Picture for: {m.usedByVariants.join(", ")}</span> : null}
                </div>
                <label className="block text-sm">
                  <span className="font-medium">Image description (alt text)</span>
                  <span className="flex gap-2">
                    <input
                      className={input}
                      value={alts[m.id] ?? ""}
                      maxLength={ALT_MAX}
                      placeholder={productTitle}
                      onChange={(e) => setAlts((a) => ({ ...a, [m.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className={btn}
                      disabled={!hydrated || busy || (alts[m.id] ?? "") === (m.alt || "")}
                      onClick={() => void run({ method: "PATCH", body: JSON.stringify({ mediaId: m.id, alt: alts[m.id] ?? "" }) })}
                    >
                      Save description
                    </button>
                  </span>
                  {m.alt && isImportedAlt(m.alt) && (alts[m.id] ?? "") === m.alt ? (
                    <span className="mt-1 block text-xs text-[var(--adm-ink-2)]" data-testid="product-media-imported-alt">
                      Imported from Shopify, so the storefront uses its own description instead. Write what the photo shows to
                      replace it.
                    </span>
                  ) : null}
                </label>
                <div className="flex flex-wrap gap-2">
                  {i > 0 ? (
                    <button
                      type="button"
                      className={btn}
                      disabled={!hydrated || busy}
                      onClick={() => void run({ method: "PATCH", body: JSON.stringify({ mediaId: m.id, makePrimary: true }) })}
                    >
                      Make primary
                    </button>
                  ) : null}
                  <button type="button" className={btn} disabled={!hydrated || busy || i === 0} aria-label={`Move image ${i + 1} up`} onClick={() => move(m.id, -1)}>
                    Up
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={!hydrated || busy || i === media.length - 1}
                    aria-label={`Move image ${i + 1} down`}
                    onClick={() => move(m.id, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className={`${btn} border-[var(--adm-danger)] text-[var(--adm-danger)]`}
                    disabled={!hydrated || busy}
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() => {
                      if (!window.confirm("Remove this image from this product? The file itself is not deleted, and other products keep their images.")) return;
                      void run({ method: "DELETE", body: JSON.stringify({ mediaId: m.id }) });
                    }}
                  >
                    Remove
                  </button>
                </div>
                {canConfirmRights ? <RightsEditor key={`${m.id}:${m.approval}:${m.rights_note ?? ""}`} row={m} disabled={!hydrated || busy} onSave={(body) => void run({ method: "PATCH", body: JSON.stringify({ mediaId: m.id, ...body }) })} /> : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--adm-border)] p-3">
          <h3 className="text-sm font-semibold">Upload an image</h3>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">JPEG, PNG, WebP or GIF, under 5 MB. It is also saved in the Media library.</p>
          <input
            key={fileKey}
            type="file"
            accept={UPLOAD_TYPES.join(",")}
            aria-label="Image file to upload"
            className="mt-2 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <label className="mt-2 block text-sm">
            <span className="font-medium">Description</span>
            <input className={input} value={newAlt} maxLength={ALT_MAX} onChange={(e) => setNewAlt(e.target.value)} placeholder={productTitle} />
          </label>
          <button
            type="button"
            className="mt-2 rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!hydrated || busy || !file}
            onClick={() => void upload()}
          >
            Upload and add
          </button>
        </div>

        <div className="rounded-lg border border-[var(--adm-border)] p-3">
          <h3 className="text-sm font-semibold">Choose from the Media library</h3>
          <div className="mt-2 flex gap-2">
            <input className={input} value={libQuery} onChange={(e) => setLibQuery(e.target.value)} placeholder="Search descriptions" aria-label="Search the Media library" />
            <button type="button" className={btn} disabled={!hydrated || busy} onClick={() => void openLibrary()}>
              {library ? "Search" : "Show"}
            </button>
          </div>
          {library ? (
            library.length ? (
              <ul className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-auto" data-testid="product-media-library">
                {library.map((item) => {
                  const assetId = item.id.replace(/^cms:/, "");
                  const already = media.some((m) => m.url === item.url);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={!hydrated || busy || already}
                        aria-label={`Add ${item.alt || "library image"}${already ? " (already added)" : ""}`}
                        className="block w-full overflow-hidden rounded border border-[var(--adm-border)] disabled:opacity-40"
                        onClick={() => void run({ method: "POST", body: JSON.stringify({ assetId }) })}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" className="h-16 w-full object-contain" loading="lazy" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--adm-ink-2)]">No uploaded images match. Upload one, or use Content → Media.</p>
            )
          ) : null}
        </div>

        <form
          method="post"
          className="rounded-lg border border-[var(--adm-border)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ method: "POST", body: JSON.stringify({ url: url.trim(), alt: newAlt }) }, () => setUrl(""));
          }}
        >
          <h3 className="text-sm font-semibold">Paste an image address</h3>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">A public https:// image you have the right to use.</p>
          <label className="mt-2 block text-sm">
            <span className="font-medium">Image address</span>
            <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/photo.jpg" inputMode="url" />
          </label>
          <button type="submit" className={`mt-2 ${btn}`} disabled={!hydrated || busy || !url.trim()}>
            Add image
          </button>
        </form>
      </div>

      {msg ? (
        <p className="mt-3 text-sm text-[var(--adm-success)]" role="status" data-testid="product-media-msg">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert" data-testid="product-media-error">
          {err}
        </p>
      ) : null}
    </section>
  );
}

function RightsEditor({ row, disabled, onSave }: { row: MediaRow; disabled: boolean; onSave: (body: { rights: "pending" | "approved"; rightsNote: string }) => void }) {
  const [rights, setRights] = useState<"pending" | "approved">(row.approval === "approved" ? "approved" : "pending");
  const [note, setNote] = useState(row.rights_note || "");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded bg-[var(--adm-surface-2)] p-2 text-sm">
      <label>
        <span className="block text-xs font-medium">Image rights</span>
        <select className="rounded border border-[var(--adm-border)] px-2 py-1 text-sm" value={rights} onChange={(e) => setRights(e.target.value as "pending" | "approved")}>
          <option value="pending">Not confirmed</option>
          <option value="approved">Confirmed (we may use it)</option>
        </select>
      </label>
      <label className="min-w-[180px] flex-1">
        <span className="block text-xs font-medium">Rights note</span>
        <input className={input} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Our own photo, 2026" />
      </label>
      <button type="button" className={btn} disabled={disabled} onClick={() => onSave({ rights, rightsNote: note })}>
        Save rights
      </button>
    </div>
  );
}
