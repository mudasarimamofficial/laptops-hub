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

export function ProductCreateForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [pricePkr, setPricePkr] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [inventoryMode, setInventoryMode] = useState<"untracked" | "tracked">("untracked");
  const [quantityOnHand, setQuantityOnHand] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onTitleChange(v: string) {
    setTitle(v);
    if (!handleTouched) setHandle(slugify(v));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          handle: handle || undefined,
          status,
          manufacturer: manufacturer.trim() || null,
          pricePkr: Number(pricePkr || 0),
          inventoryMode,
          quantityOnHand: inventoryMode === "tracked" ? Number(quantityOnHand) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Create failed (${res.status})`);
        return;
      }
      router.push(`/admin/products/${encodeURIComponent(data.handle)}`);
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
          onChange={(e) => onTitleChange(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">URL handle</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm"
          value={handle}
          onChange={(e) => {
            setHandleTouched(true);
            setHandle(e.target.value.toLowerCase());
          }}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Price (PKR)</span>
          <input
            type="number"
            min={0}
            step={1}
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
            value={pricePkr}
            onChange={(e) => setPricePkr(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "active")}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Brand / manufacturer</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
        />
      </label>
      <fieldset className="space-y-2 rounded-lg border border-[var(--adm-border)] p-3">
        <legend className="px-1 text-sm font-medium">Inventory</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="inv"
            checked={inventoryMode === "untracked"}
            onChange={() => setInventoryMode("untracked")}
            className="mt-1"
          />
          <span>
            <strong>Confirm availability</strong>
            <span className="block text-[var(--adm-ink-2)]">
              Untracked — staff confirms stock before dispatch. Not unlimited stock.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="inv"
            checked={inventoryMode === "tracked"}
            onChange={() => setInventoryMode("tracked")}
            className="mt-1"
          />
          <span>
            <strong>Tracked quantity</strong>
            <span className="block text-[var(--adm-ink-2)]">Requires a real starting count.</span>
          </span>
        </label>
        {inventoryMode === "tracked" ? (
          <label className="block text-sm">
            <span className="font-medium">Starting quantity</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
              value={quantityOnHand}
              onChange={(e) => setQuantityOnHand(e.target.value)}
              required
            />
          </label>
        ) : null}
      </fieldset>

      {err ? (
        <p className="rounded-lg border border-[var(--adm-danger)] bg-[var(--adm-danger-bg)] px-3 py-2 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!hydrated || busy}
        className="rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)] disabled:opacity-50"
      >
        {!hydrated ? "Preparing…" : busy ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
