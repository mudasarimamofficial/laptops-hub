"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Props = {
  initial: {
    businessName: string;
    supportEmail: string;
    supportPhone: string;
    trackProductInventory: boolean;
    inventoryDefaultTracked: boolean;
    lowStockDefault: number;
    pdpCta: "add_to_cart" | "buy_now";
    seoTitleSuffix: string;
    showCatalogCounts: boolean;
    showStoryAngleLabels: boolean;
    showSectionNumbers: boolean;
  };
};

export function StoreSettingsForm({ initial }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [trackProductInventory, setTrackProductInventory] = useState(initial.trackProductInventory);
  const [inventoryDefaultTracked, setInventoryDefaultTracked] = useState(initial.inventoryDefaultTracked);
  const [lowStockDefault, setLowStockDefault] = useState(String(initial.lowStockDefault));
  const [pdpCta, setPdpCta] = useState<"add_to_cart" | "buy_now">(initial.pdpCta);
  const [seoTitleSuffix, setSeoTitleSuffix] = useState(initial.seoTitleSuffix);
  const [showCatalogCounts, setShowCatalogCounts] = useState(initial.showCatalogCounts);
  const [showStoryAngleLabels, setShowStoryAngleLabels] = useState(initial.showStoryAngleLabels);
  const [showSectionNumbers, setShowSectionNumbers] = useState(initial.showSectionNumbers);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackProductInventory,
          inventoryDefaultTracked,
          lowStockDefault: Number(lowStockDefault) || 0,
          pdpCta,
          seoTitleSuffix,
          showCatalogCounts,
          showStoryAngleLabels,
          showSectionNumbers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Store settings saved.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Business identity</h2>
      <p className="text-sm text-[var(--adm-ink-2)]">
        Ordinary merchant settings. Production COD release switches and infrastructure secrets stay outside this form.
      </p>
      {/* G15: the business name, email and phones the site shows are edited in Contact & Social only (one source). */}
      <div className="rounded-lg border border-[var(--adm-divider)] p-3 text-sm" data-testid="store-identity-summary">
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className="text-[var(--adm-ink-2)]">Business name</dt>
          <dd className="font-medium text-[var(--adm-ink)]">{initial.businessName || "—"}</dd>
          <dt className="text-[var(--adm-ink-2)]">Support email</dt>
          <dd className="font-medium text-[var(--adm-ink)]">{initial.supportEmail || "—"}</dd>
          <dt className="text-[var(--adm-ink-2)]">Primary phone</dt>
          <dd className="font-medium text-[var(--adm-ink)]">{initial.supportPhone || "—"}</dd>
        </dl>
        <p className="mt-2 text-xs text-[var(--adm-ink-2)]">
          These come from{" "}
          <a href="#contact-social" className="font-semibold text-[var(--adm-action)] underline">
            Contact &amp; Social
          </a>
          , which is what the storefront, footer and search markup use. Change them there.
        </p>
      </div>
      <fieldset id="products-inventory" className="space-y-3 border-t border-[var(--adm-divider)] pt-4">
        <legend className="font-semibold">Products &amp; Inventory</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            role="switch"
            aria-checked={trackProductInventory}
            checked={trackProductInventory}
            onChange={(e) => {
              const next = e.target.checked;
              if (next && !trackProductInventory) {
                const ok = window.confirm(
                  "Turn on inventory tracking? Only variants set to “tracked” inventory will enforce stock counts. Untracked variants stay sellable. Zero-stock tracked variants may show as sold out until you restock them.",
                );
                if (!ok) return;
              }
              setTrackProductInventory(next);
            }}
          />
          <span>
            <span className="font-medium">Track product inventory</span>
            <span className="mt-1 block text-[var(--adm-ink-2)]">
              When OFF, published products stay buyable even at zero recorded stock. When ON, each variant that uses
              tracked inventory must have enough stock (unless that variant allows overselling). Untracked variants are
              unaffected. Draft and unpublished products stay hidden either way.
            </span>
            <span className="mt-1 block text-xs text-[var(--adm-ink-2)]" aria-live="polite">
              Status:{" "}
              {trackProductInventory
                ? "ON — tracked variants respect stock quantities"
                : "OFF — stock counts do not block purchase"}
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inventoryDefaultTracked}
            onChange={(e) => setInventoryDefaultTracked(e.target.checked)}
          />
          New products default to tracked inventory
        </label>
        <label className="block text-sm">
          Default low-stock threshold
          <span className="block text-xs text-[var(--adm-ink-2)]">
            Inventory → Low lists tracked variants at or below this many units. 0 keeps the built-in 2.
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-40 rounded-lg border border-[var(--adm-border)] px-3 py-2"
            value={lowStockDefault}
            onChange={(e) => setLowStockDefault(e.target.value)}
          />
        </label>
      </fieldset>
      <fieldset id="storefront-checkout" className="space-y-3 border-t border-[var(--adm-divider)] pt-4">
        <legend className="font-semibold">Storefront &amp; Checkout</legend>
        <p className="text-sm text-[var(--adm-ink-2)]">
          Product page checkout behavior applies only to the main button on individual product pages. Collection and
          search Add to cart buttons are unchanged.
        </p>
        <div className="space-y-2 text-sm" role="radiogroup" aria-label="Product page checkout behavior">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="pdpCta"
              className="mt-1"
              checked={pdpCta === "add_to_cart"}
              onChange={() => setPdpCta("add_to_cart")}
            />
            <span>
              <span className="font-medium">Add to cart</span>
              <span className="mt-0.5 block text-[var(--adm-ink-2)]">The main product page button adds the selected item to the cart.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="pdpCta"
              className="mt-1"
              checked={pdpCta === "buy_now"}
              onChange={() => setPdpCta("buy_now")}
            />
            <span>
              <span className="font-medium">Buy now — Go directly to checkout</span>
              <span className="mt-0.5 block text-[var(--adm-ink-2)]">
                The main product page button starts checkout for the selected item without visiting the cart first. The
                customer&apos;s existing cart is preserved.
              </span>
            </span>
          </label>
        </div>
      </fieldset>
      <label className="block text-sm">
        SEO title suffix
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
          value={seoTitleSuffix}
          onChange={(e) => setSeoTitleSuffix(e.target.value)}
          placeholder=" | Laptops HUB"
        />
      </label>
      <fieldset className="space-y-2 border-t border-[var(--adm-divider)] pt-4">
        <legend className="font-semibold">Storefront labels</legend>
        <p className="text-sm text-[var(--adm-ink-2)]">
          Presentation only — products and categories are not changed. Off by default at the owner’s request.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={showCatalogCounts} onChange={(e) => setShowCatalogCounts(e.target.checked)} />
          <span>Show catalog counts (e.g. “226 listings”, “View all 170”, footer product count)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={showStoryAngleLabels} onChange={(e) => setShowStoryAngleLabels(e.target.checked)} />
          <span>Show product-story angle labels (e.g. “Front view · 1/4”)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={showSectionNumbers} onChange={(e) => setShowSectionNumbers(e.target.checked)} />
          <span>Show homepage section numbers (e.g. “02 — Product story”)</span>
        </label>
      </fieldset>
      <div id="inventory" className="scroll-mt-24" />
      <div id="checkout" className="scroll-mt-24" />
      <button
        type="submit"
        disabled={!hydrated || busy}
        className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
      {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </form>
  );
}
