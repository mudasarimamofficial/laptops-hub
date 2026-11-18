"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { admInputClass } from "@/components/admin/ui/admin-field";

/** Media library upload desk for merchant-owned CMS images. */
export function CmsMediaUploadPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("alt", alt.trim());
      const res = await fetch("/api/admin/media/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setMsg("Image uploaded. It is available in Blog and other pickers.");
      setAlt("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div
      className="mb-6 rounded-[var(--adm-radius-lg)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
    >
      <p className="text-sm font-semibold text-[var(--adm-ink)]">Upload store image</p>
      <p className="mt-1 text-xs text-[var(--adm-ink-2)]">JPEG, PNG, WebP or GIF · max 5 MB · stored in the CMS media library (not product rights queue).</p>
      <label className="mt-3 block text-xs font-medium text-[var(--adm-ink-2)]">
        Alt text
        <input className={admInputClass} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="Short description for accessibility" />
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="mt-3 block w-full text-sm"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {busy ? <p className="mt-2 text-xs text-[var(--adm-ink-2)]">Uploading…</p> : null}
      {msg ? <p className="mt-2 text-xs text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p role="alert" className="mt-2 text-xs text-[var(--adm-danger)]">
          {err}
        </p>
      ) : null}
    </div>
  );
}
