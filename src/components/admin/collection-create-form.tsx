"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CollectionCreateForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [collectionType, setCollectionType] = useState<"manual" | "automated">("manual");
  const [manufacturer, setManufacturer] = useState("");
  const [minRamGb, setMinRamGb] = useState("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const rule: Record<string, unknown> | undefined =
        collectionType === "automated"
          ? {
              match: "all",
              conditions: [
                ...(manufacturer.trim()
                  ? [{ field: "manufacturer", op: "eq", value: manufacturer.trim() }]
                  : []),
                ...(minRamGb.trim()
                  ? [{ field: "specs.ram_gb", op: "gte", value: Number(minRamGb) }]
                  : []),
              ],
            }
          : undefined;

      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: slug || undefined,
          description,
          published,
          collectionType,
          rule,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Create failed (${res.status})`);
        return;
      }
      router.push(`/admin/collections/${encodeURIComponent(data.slug)}`);
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="max-w-xl space-y-5 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]"
    >
      <label className="block text-sm">
        <span className="font-medium">Title</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Handle (slug)</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Description</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type</legend>
        <label className="flex gap-2 text-sm">
          <input
            type="radio"
            checked={collectionType === "manual"}
            onChange={() => setCollectionType("manual")}
          />
          Manual — add products yourself
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="radio"
            checked={collectionType === "automated"}
            onChange={() => setCollectionType("automated")}
          />
          Automated — match conditions (storefront evaluation expands in Phase 3)
        </label>
      </fieldset>
      {collectionType === "automated" ? (
        <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-[var(--adm-border)] p-3">
          <label className="block text-sm">
            <span className="font-medium">Manufacturer equals</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="HP"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">RAM (GB) ≥</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
              value={minRamGb}
              onChange={(e) => setMinRamGb(e.target.value)}
              placeholder="16"
            />
          </label>
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Published
      </label>
      {err ? (
        <p className="text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!hydrated || busy}
        className="rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {!hydrated ? "Preparing…" : busy ? "Creating…" : "Create collection"}
      </button>
    </form>
  );
}
