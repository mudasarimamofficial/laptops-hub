"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Seeds the four V5 guide templates as unpublished drafts (never publishes). */
export function ImportGuideDraftsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        data-testid="blog-import-guide-drafts"
        disabled={busy}
        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--adm-border)] bg-white px-3 text-sm font-semibold disabled:opacity-50"
        onClick={() => {
          void (async () => {
            if (!window.confirm("Import four factual guide drafts as unpublished? Existing slugs are skipped. Nothing is published.")) {
              return;
            }
            setBusy(true);
            setNote(null);
            const res = await fetch("/api/admin/posts/import-guide-drafts", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
            const json = (await res.json().catch(() => ({}))) as { message?: string };
            setBusy(false);
            setNote(json.message || (res.ok ? "Done." : "Import failed."));
            if (res.ok) startTransition(() => router.refresh());
          })();
        }}
      >
        {busy ? "Importing…" : "Import guide drafts"}
      </button>
      {note ? <span className="max-w-xs text-right text-xs text-[var(--adm-ink-2)]">{note}</span> : null}
    </div>
  );
}
