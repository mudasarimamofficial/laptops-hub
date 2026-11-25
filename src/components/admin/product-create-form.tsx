"use client";

import { useId, useState } from "react";
import { COLLECTION_BRANDS } from "@/lib/catalog/taxonomy-options";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminEditorLayout } from "@/components/admin/ui/admin-editor-layout";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";
import { AdminSaveBar } from "@/components/admin/ui/admin-save-bar";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ProductCreateForm({ defaultTracked = false }: { defaultTracked?: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const handleId = useId(); // the input sits in a prefix wrapper, so AdminField cannot wire the label itself
  const [handleTouched, setHandleTouched] = useState(false);
  const [pricePkr, setPricePkr] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [inventoryMode, setInventoryMode] = useState<"untracked" | "tracked">(defaultTracked ? "tracked" : "untracked");
  const [quantityOnHand, setQuantityOnHand] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onTitleChange(v: string) {
    setTitle(v);
    if (!handleTouched) setHandle(slugify(v));
  }

  async function onSubmit() {
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

  const dirty = Boolean(title.trim() || handle.trim() || pricePkr.trim() || manufacturer.trim());

  const main = (
    <AdminCard title="Product details" description="Creates a draft (or active) product with one default variant. Media and option matrix come next.">
      <div className="space-y-4">
        <AdminField label="Title">
          <input
            className={admInputClass}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Dell Latitude 7490"
          />
        </AdminField>
        <AdminField label="Web address" htmlFor={handleId} hint="Shown on the storefront under /products/">
          <span className="mt-1 flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-sm text-[var(--adm-ink-2)]">/products/</span>
            <input
              id={handleId}
              className={admInputClass.replace("mt-1 ", "")}
              value={handle}
              onChange={(e) => {
                setHandleTouched(true);
                setHandle(e.target.value.toLowerCase());
              }}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </span>
        </AdminField>
        <AdminField label="Starting price (PKR)">
          <input
            type="number"
            min={0}
            step={1}
            className={admInputClass}
            value={pricePkr}
            onChange={(e) => setPricePkr(e.target.value)}
          />
        </AdminField>
        <AdminField label="Brand / manufacturer" optional>
          <input
            className={admInputClass}
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            list="admin-brand-options-new"
            placeholder="Dell / HP / Lenovo…"
          />
          <datalist id="admin-brand-options-new">
            {COLLECTION_BRANDS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </AdminField>
      </div>
    </AdminCard>
  );

  const aside = (
    <>
      <AdminCard title="Status">
        <AdminField label="Visibility">
          <select className={admInputClass} value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")}>
            <option value="draft">Draft — hidden from shoppers</option>
            <option value="active">Active — for sale</option>
          </select>
        </AdminField>
      </AdminCard>
      <AdminCard title="Inventory" description="Global store tracking can stay off — this only sets the first variant.">
        <fieldset className="space-y-2">
          <legend className="sr-only">Inventory</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="inv" checked={inventoryMode === "untracked"} onChange={() => setInventoryMode("untracked")} className="mt-1" />
            <span>
              <strong>Confirm availability</strong>
              <span className="block text-[var(--adm-ink-2)]">Untracked — staff confirms stock before dispatch. Not unlimited stock.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="inv" checked={inventoryMode === "tracked"} onChange={() => setInventoryMode("tracked")} className="mt-1" />
            <span>
              <strong>Tracked quantity</strong>
              <span className="block text-[var(--adm-ink-2)]">Requires a real starting count.</span>
            </span>
          </label>
          {inventoryMode === "tracked" ? (
            <AdminField label="Starting quantity">
              <input
                type="number"
                min={0}
                className={admInputClass}
                value={quantityOnHand}
                onChange={(e) => setQuantityOnHand(e.target.value)}
                required
              />
            </AdminField>
          ) : null}
        </fieldset>
      </AdminCard>
    </>
  );

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="text-sm"
    >
      <AdminEditorLayout main={main} aside={aside} />
      <AdminSaveBar dirty={dirty} busy={busy || !hydrated} error={err} onSave={() => void onSubmit()} saveLabel="Create product" />
    </form>
  );
}
