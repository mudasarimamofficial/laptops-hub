"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";

type Initial = { title: string; description: string; published: boolean; seoTitle: string; seoDescription: string };
type Props = { slug: string; builtIn: boolean; initial: Initial };

/**
 * Admin → collection → Details (G05). Merchant collections: title, description, visibility and search text.
 * Built-in storefront collections: search text only (their products, title and visibility come from the storefront).
 */
export function CollectionDetailsForm({ slug, builtIn, initial }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Initial>(k: K, val: Initial[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    setMsg(null);
    setErr(null);
    if (!builtIn && v.title.trim().length < 2) {
      setErr("The title needs at least 2 characters.");
      return;
    }
    if (!builtIn && initial.published && !v.published && !window.confirm("Hide this collection from the storefront? Its page will show “not found” until you publish it again.")) {
      return;
    }
    const body: Record<string, unknown> = {
      seoTitle: v.seoTitle.trim() || null,
      seoDescription: v.seoDescription.trim() || null,
    };
    if (!builtIn) {
      body.title = v.title.trim();
      body.description = v.description;
      body.published = v.published;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `Save failed (${res.status})`);
        return;
      }
      setMsg(builtIn ? "Search text saved." : v.published ? "Collection saved. The storefront shows it within a minute." : "Collection saved and hidden from the storefront.");
      router.refresh();
    } catch {
      setErr("Network error. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
      data-testid="collection-details-form"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Details</h2>
      {builtIn ? (
        <p className="mt-1 max-w-3xl text-sm text-[var(--adm-ink-2)]" data-testid="collection-built-in-note">
          This is a <strong>built-in storefront collection</strong>. Its products, title and visibility come from the
          storefront itself (for example, “All laptops” always lists every laptop), so they are not edited here. You can set
          the text Google shows for this page.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {!builtIn ? (
          <>
            <AdminField label="Title">
              <input className={admInputClass} value={v.title} maxLength={160} onChange={(e) => set("title", e.target.value)} />
            </AdminField>
            <label className="mt-6 flex items-center gap-2 text-sm font-medium text-[var(--adm-ink)]">
              <input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} />
              Visible on the storefront
            </label>
            <div className="md:col-span-2">
              <AdminField label="Description" hint="Used for search results and sharing when no search description is set.">
                <textarea className={admInputClass} rows={3} value={v.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} />
              </AdminField>
            </div>
          </>
        ) : null}
        <AdminField label="Search title" hint={`Leave empty to use the collection title. ${v.seoTitle.length}/200`}>
          <input className={admInputClass} value={v.seoTitle} maxLength={200} onChange={(e) => set("seoTitle", e.target.value)} />
        </AdminField>
        <AdminField label="Search description" hint={`Only true facts about the collection. ${v.seoDescription.length}/500`}>
          <textarea className={admInputClass} rows={2} value={v.seoDescription} maxLength={500} onChange={(e) => set("seoDescription", e.target.value)} />
        </AdminField>
      </div>

      {err ? (
        <p role="alert" className="mt-3 text-sm text-[var(--adm-danger)]" data-testid="collection-details-error">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="mt-3 text-sm text-[var(--adm-success)]" data-testid="collection-details-saved">
          {msg}
        </p>
      ) : null}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!hydrated || busy}
          className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>
    </section>
  );
}
