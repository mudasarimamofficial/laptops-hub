"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPkr, paisaToMajor } from "@/lib/money";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Variant = {
  id: string;
  title: string;
  sku: string | null;
  pricePaisa: number;
};

type Props = {
  handle: string;
  title: string;
  descriptionSafe: string;
  status: "draft" | "active" | "archived";
  featured: boolean;
  manufacturer: string | null;
  productType: string | null;
  category: string | null;
  variants: Variant[];
};

export function ProductEditForm(props: Props) {
  const router = useRouter();
  // Before hydration the submit stays disabled (and forms post): a click can never become a GET page reload.
  const hydrated = useHydrated();
  const [title, setTitle] = useState(props.title);
  const [descriptionSafe, setDescriptionSafe] = useState(props.descriptionSafe);
  const [status, setStatus] = useState(props.status);
  const [featured, setFeatured] = useState(props.featured);
  const [manufacturer, setManufacturer] = useState(props.manufacturer || "");
  const [productType, setProductType] = useState(props.productType || "");
  const [category, setCategory] = useState(props.category || "");
  const [variantId, setVariantId] = useState(props.variants[0]?.id || "");
  const selected = props.variants.find((v) => v.id === variantId) || props.variants[0];
  const [pricePkr, setPricePkr] = useState(String(paisaToMajor(selected?.pricePaisa || 0)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onVariantChange(id: string) {
    setVariantId(id);
    const v = props.variants.find((x) => x.id === id);
    if (v) setPricePkr(String(paisaToMajor(v.pricePaisa)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        title,
        descriptionSafe,
        status,
        featured,
        manufacturer: manufacturer.trim() || null,
        productType: productType.trim() || null,
        category: category.trim() || null,
      };
      if (variantId && pricePkr) {
        body.variantId = variantId;
        body.pricePkr = Number(pricePkr);
      }
      const res = await fetch(`/api/admin/products/${encodeURIComponent(props.handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Saved. Only the selected variant price was updated.");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="mt-8 max-w-2xl space-y-5">
      <label className="block text-sm">
        <span className="font-medium">Title</span>
        <input
          className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Description (safe / public)</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          rows={6}
          value={descriptionSafe}
          onChange={(e) => setDescriptionSafe(e.target.value)}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as Props["status"])}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Variant to price</span>
          <select
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            value={variantId}
            onChange={(e) => onVariantChange(e.target.value)}
            required
          >
            {props.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title || "Default"}
                {v.sku ? ` · ${v.sku}` : ""} · {formatPkr(v.pricePaisa)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Price for selected variant (PKR)</span>
        <input
          type="number"
          min={1}
          step={1}
          className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
          value={pricePkr}
          onChange={(e) => setPricePkr(e.target.value)}
          required
        />
        <span className="mt-1 block text-xs text-[var(--lh-ink-2)]">
          Other variants keep their own prices. Stock counts are never shown publicly.
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Manufacturer</span>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="Dell / HP / Lenovo…"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Type</span>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Category</span>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        Featured on storefront
      </label>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      <button
        type="submit"
        disabled={busy || !hydrated}
        className="rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
