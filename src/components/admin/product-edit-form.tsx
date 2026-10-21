"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPkr, paisaToMajor } from "@/lib/money";

type Props = {
  handle: string;
  title: string;
  descriptionSafe: string;
  status: "draft" | "active" | "archived";
  featured: boolean;
  manufacturer: string | null;
  productType: string | null;
  category: string | null;
  pricePaisa: number;
};

export function ProductEditForm(props: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(props.title);
  const [descriptionSafe, setDescriptionSafe] = useState(props.descriptionSafe);
  const [status, setStatus] = useState(props.status);
  const [featured, setFeatured] = useState(props.featured);
  const [manufacturer, setManufacturer] = useState(props.manufacturer || "");
  const [productType, setProductType] = useState(props.productType || "");
  const [category, setCategory] = useState(props.category || "");
  const [pricePkr, setPricePkr] = useState(String(paisaToMajor(props.pricePaisa)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(props.handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          descriptionSafe,
          status,
          featured,
          manufacturer: manufacturer.trim() || null,
          productType: productType.trim() || null,
          category: category.trim() || null,
          pricePkr: Number(pricePkr),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Saved.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-2xl space-y-5">
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
          <span className="font-medium">Price (PKR)</span>
          <input
            type="number"
            min={1}
            step={1}
            className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2"
            value={pricePkr}
            onChange={(e) => setPricePkr(e.target.value)}
            required
          />
          <span className="mt-1 block text-xs text-[var(--lh-ink-2)]">Current: {formatPkr(props.pricePaisa)}</span>
        </label>
      </div>
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
        disabled={busy}
        className="rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
