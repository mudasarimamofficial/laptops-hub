"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPkr, paisaToMajor } from "@/lib/money";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminEditorLayout } from "@/components/admin/ui/admin-editor-layout";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";
import { AdminSaveBar } from "@/components/admin/ui/admin-save-bar";

type Variant = {
  id: string;
  title: string;
  sku: string | null;
  pricePaisa: number;
  inventoryMode?: "tracked" | "untracked";
  quantityOnHand?: number | null;
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
  seoTitle?: string | null;
  seoDescription?: string | null;
  variants: Variant[];
};

/** Product core editor — Admin VNext two-column desk (variants/media remain sibling modules). */
export function ProductEditForm(props: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState(props.title);
  const [descriptionSafe, setDescriptionSafe] = useState(props.descriptionSafe);
  const [status, setStatus] = useState(props.status);
  const [featured, setFeatured] = useState(props.featured);
  const [manufacturer, setManufacturer] = useState(props.manufacturer || "");
  const [productType, setProductType] = useState(props.productType || "");
  const [category, setCategory] = useState(props.category || "");
  const [seoTitle, setSeoTitle] = useState(props.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(props.seoDescription || "");
  const [variantId, setVariantId] = useState(props.variants[0]?.id || "");
  const selected = props.variants.find((v) => v.id === variantId) || props.variants[0];
  const [pricePkr, setPricePkr] = useState(String(paisaToMajor(selected?.pricePaisa || 0)));
  const [inventoryMode, setInventoryMode] = useState<"tracked" | "untracked">(
    selected?.inventoryMode === "tracked" ? "tracked" : "untracked",
  );
  const [quantityOnHand, setQuantityOnHand] = useState(String(selected?.quantityOnHand ?? 0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        descriptionSafe,
        status,
        featured,
        manufacturer,
        productType,
        category,
        seoTitle,
        seoDescription,
        variantId,
        pricePkr,
        inventoryMode,
        quantityOnHand,
      }),
    [
      title,
      descriptionSafe,
      status,
      featured,
      manufacturer,
      productType,
      category,
      seoTitle,
      seoDescription,
      variantId,
      pricePkr,
      inventoryMode,
      quantityOnHand,
    ],
  );
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function onVariantChange(id: string) {
    setVariantId(id);
    const v = props.variants.find((x) => x.id === id);
    if (v) {
      setPricePkr(String(paisaToMajor(v.pricePaisa)));
      setInventoryMode(v.inventoryMode === "tracked" ? "tracked" : "untracked");
      setQuantityOnHand(String(v.quantityOnHand ?? 0));
    }
  }

  async function save() {
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
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      };
      if (variantId && pricePkr) {
        body.variantId = variantId;
        body.pricePkr = Number(pricePkr);
        body.inventoryMode = inventoryMode;
        body.quantityOnHand = inventoryMode === "tracked" ? Number(quantityOnHand) : null;
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
      setBaseline(snapshot);
      setMsg("Product saved.");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(props.handle)}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || "Duplicate failed");
        return;
      }
      router.push(`/admin/products/${encodeURIComponent(data.handle)}`);
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  const main = (
    <>
      <AdminCard title="Title and description" description="What customers see on the product page.">
        <div className="space-y-4">
          <AdminField label="Title">
            <input className={admInputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </AdminField>
          <AdminField label="Description" optional hint="Public-safe copy only. Do not invent warranty or delivery promises.">
            <textarea className={admInputClass} rows={6} value={descriptionSafe} onChange={(e) => setDescriptionSafe(e.target.value)} />
          </AdminField>
        </div>
      </AdminCard>

      <AdminCard title="Pricing for one variant" description="Use the variant matrix below for RAM/storage options. This card updates the selected variant only.">
        <div className="space-y-4">
          <AdminField label="Variant">
            <select className={admInputClass} value={variantId} onChange={(e) => onVariantChange(e.target.value)} required>
              {props.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title || "Default"}
                  {v.sku ? ` · ${v.sku}` : ""} · {formatPkr(v.pricePaisa)}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Price (PKR)" hint="Other variants keep their own prices. Stock counts stay private.">
            <input
              type="number"
              min={1}
              step={1}
              className={admInputClass}
              value={pricePkr}
              onChange={(e) => setPricePkr(e.target.value)}
              required
            />
          </AdminField>
          <fieldset className="space-y-2 rounded-[var(--adm-radius)] border border-[var(--adm-border)] p-3">
            <legend className="px-1 text-sm font-medium">Inventory for this variant</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="inv" checked={inventoryMode === "untracked"} onChange={() => setInventoryMode("untracked")} className="mt-1" />
              <span>
                Confirm availability
                <span className="block text-xs text-[var(--adm-ink-2)]">Not unlimited stock — staff confirms before dispatch.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="inv" checked={inventoryMode === "tracked"} onChange={() => setInventoryMode("tracked")} className="mt-1" />
              <span>Tracked quantity</span>
            </label>
            {inventoryMode === "tracked" ? (
              <AdminField label="Quantity on hand">
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
        </div>
      </AdminCard>

      <AdminCard title="Search engine listing">
        <div className="space-y-3">
          <AdminField label={`Page title (${seoTitle.length}/200)`} optional>
            <input className={admInputClass} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} placeholder={title} />
          </AdminField>
          <AdminField label={`Description (${seoDescription.length}/500)`} optional>
            <textarea className={admInputClass} rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={500} />
          </AdminField>
          <div className="rounded-[var(--adm-radius)] bg-[var(--adm-surface-2)] p-3 text-xs text-[var(--adm-ink-2)]">
            <p className="font-semibold text-[var(--adm-ink)]">Search preview</p>
            <p className="mt-1 text-[var(--adm-action)]">{seoTitle || title || "Product title"}</p>
            <p className="text-[var(--adm-success)]">laptopshub.pk/products/{props.handle}</p>
            <p>{seoDescription || "Meta description appears here."}</p>
          </div>
        </div>
      </AdminCard>
    </>
  );

  const aside = (
    <>
      <AdminCard title="Status">
        <AdminField label="Visibility">
          <select className={admInputClass} value={status} onChange={(e) => setStatus(e.target.value as Props["status"])}>
            <option value="draft">Draft — hidden from shoppers</option>
            <option value="active">Active — for sale</option>
            <option value="archived">Archived</option>
          </select>
        </AdminField>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Feature on storefront where supported
        </label>
      </AdminCard>

      <AdminCard title="Organization" description="Laptop retail grouping for filters and lists.">
        <div className="space-y-3">
          <AdminField label="Brand / manufacturer" optional>
            <input className={admInputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Dell / HP / Lenovo…" />
          </AdminField>
          <AdminField label="Type" optional>
            <input className={admInputClass} value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Notebook" />
          </AdminField>
          <AdminField label="Category" optional>
            <input className={admInputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Business" />
          </AdminField>
        </div>
      </AdminCard>
    </>
  );

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mt-6 text-sm"
    >
      <AdminEditorLayout main={main} aside={aside} />
      <AdminSaveBar
        dirty={dirty}
        busy={busy || !hydrated}
        savedMessage={msg}
        error={err}
        onSave={() => void save()}
        saveLabel="Save product"
        secondary={
          <button
            type="button"
            disabled={!hydrated || busy}
            onClick={() => void duplicate()}
            className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-4 text-sm font-semibold disabled:opacity-50"
          >
            Duplicate
          </button>
        }
      />
    </form>
  );
}
