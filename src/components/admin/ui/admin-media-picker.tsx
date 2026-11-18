"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { admInputClass } from "@/components/admin/ui/admin-field";

type LibraryItem = { id: string; url: string; alt: string | null; label?: string; source?: string };

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
};

/**
 * Cover/image picker for CMS desks.
 * Supports upload to cms-media, library selection, and HTTPS URL paste.
 */
export function AdminMediaPicker({ label, value, onChange, hint }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [q, setQ] = useState("");

  async function loadLibrary(search = q) {
    setOpen(true);
    setLoading(true);
    setErr(null);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/admin/media/library${qs}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load media");
      setItems(data.items || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load media");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress("Uploading…");
    setErr(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("alt", altDraft.trim());
      const res = await fetch("/api/admin/media/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      onChange(data.url as string);
      setProgress("Uploaded");
      setOpen(false);
      setItems((prev) => [{ id: data.id, url: data.url, alt: data.alt || null, label: "Uploaded", source: "cms" }, ...prev]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setProgress(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--adm-ink)]">{label}</p>
      {value ? (
        <div className="relative overflow-hidden rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- merchant-supplied HTTPS cover preview */}
          <img src={value} alt="" className="mx-auto max-h-40 object-contain" />
          <div className="flex flex-wrap gap-2 border-t border-[var(--adm-border)] bg-[var(--adm-surface)] p-2">
            <button type="button" className="rounded-md border border-[var(--adm-border)] px-2.5 py-1.5 text-xs font-semibold" onClick={() => void loadLibrary()}>
              Replace
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--adm-danger)] px-2.5 py-1.5 text-xs font-semibold text-[var(--adm-danger)]"
              onClick={() => onChange("")}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void loadLibrary()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex w-full min-h-[120px] flex-col items-center justify-center gap-1 rounded-[var(--adm-radius)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-6 text-sm text-[var(--adm-ink-2)] hover:border-[var(--adm-focus)]"
        >
          <span className="font-semibold text-[var(--adm-ink)]">Add image</span>
          <span className="text-xs">Upload, choose from library, or paste a URL</span>
        </button>
      )}

      {open || !value ? (
        <div className="space-y-3 rounded-[var(--adm-radius)] border border-[var(--adm-border)] p-3">
          <div
            className="rounded-[var(--adm-radius)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <p className="text-xs font-medium text-[var(--adm-ink)]">Upload from your device</p>
            <AdminFieldAlt altDraft={altDraft} setAltDraft={setAltDraft} />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mt-2 block w-full text-xs"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            {progress ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{progress}</p> : null}
          </div>

          <label className="block text-xs font-medium text-[var(--adm-ink-2)]">
            Image URL
            <input className={admInputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://" maxLength={500} />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[10rem] flex-1 text-xs font-medium text-[var(--adm-ink-2)]">
              Search library
              <input
                className={admInputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadLibrary(q);
                  }
                }}
                placeholder="Title or alt text"
              />
            </label>
            <button
              type="button"
              className="min-h-10 rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 text-xs font-semibold"
              onClick={() => void loadLibrary(q)}
            >
              Search
            </button>
          </div>

          {loading ? <p className="text-xs text-[var(--adm-ink-2)]">Loading…</p> : null}
          {err ? (
            <p role="alert" className="text-xs text-[var(--adm-danger)]">
              {err}
            </p>
          ) : null}
          {open && !loading ? (
            <ul className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {items.length === 0 ? <li className="col-span-full text-xs text-[var(--adm-ink-2)]">No images yet — upload one above.</li> : null}
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="relative block aspect-square w-full overflow-hidden rounded-md border border-[var(--adm-border)] hover:border-[var(--adm-action)]"
                    onClick={() => {
                      onChange(item.url);
                      setOpen(false);
                    }}
                    title={item.label || item.alt || "Select image"}
                  >
                    <Image src={item.url} alt={item.alt || ""} fill className="object-cover" sizes="96px" unoptimized />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {hint ? <p className="text-xs text-[var(--adm-ink-2)]">{hint}</p> : null}
    </div>
  );
}

function AdminFieldAlt({ altDraft, setAltDraft }: { altDraft: string; setAltDraft: (v: string) => void }) {
  return (
    <label className="mt-2 block text-xs text-[var(--adm-ink-2)]">
      Alt text (optional)
      <input className={admInputClass} value={altDraft} onChange={(e) => setAltDraft(e.target.value)} maxLength={200} placeholder="Describe the image for accessibility" />
    </label>
  );
}
