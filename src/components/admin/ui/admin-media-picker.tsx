"use client";

import { useState } from "react";
import Image from "next/image";
import { admInputClass } from "@/components/admin/ui/admin-field";

type LibraryItem = { id: string; url: string; alt: string | null; label?: string };

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
};

/**
 * Cover/image picker for CMS desks.
 * Merchants can paste a URL or choose an approved product media reference.
 * Does not invent uploads to a new CDN — reuses existing approved assets + external HTTPS URLs.
 */
export function AdminMediaPicker({ label, value, onChange, hint }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadLibrary() {
    setOpen(true);
    if (items.length > 0 || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/media/library", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load media");
      setItems(data.items || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load media");
    } finally {
      setLoading(false);
    }
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
          className="flex w-full min-h-[120px] flex-col items-center justify-center gap-1 rounded-[var(--adm-radius)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-6 text-sm text-[var(--adm-ink-2)] hover:border-[var(--adm-focus)]"
        >
          <span className="font-semibold text-[var(--adm-ink)]">Add image</span>
          <span className="text-xs">Choose from library or paste a URL</span>
        </button>
      )}

      {open || !value ? (
        <div className="space-y-2 rounded-[var(--adm-radius)] border border-[var(--adm-border)] p-3">
          <label className="block text-xs font-medium text-[var(--adm-ink-2)]">
            Image URL
            <input
              className={admInputClass}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://"
              maxLength={500}
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--adm-ink)]">From library</p>
            {!open ? (
              <button type="button" className="text-xs font-semibold text-[var(--adm-action)]" onClick={() => void loadLibrary()}>
                Browse
              </button>
            ) : null}
          </div>
          {loading ? <p className="text-xs text-[var(--adm-ink-2)]">Loading…</p> : null}
          {err ? (
            <p role="alert" className="text-xs text-[var(--adm-danger)]">
              {err}
            </p>
          ) : null}
          {open && !loading ? (
            <ul className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {items.length === 0 ? <li className="col-span-full text-xs text-[var(--adm-ink-2)]">No approved product images yet.</li> : null}
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
