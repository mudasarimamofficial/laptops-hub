"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

export type MemberRow = {
  product_id: string;
  position: number;
  products: { id: string; handle: string; title: string; status: string } | null;
};

type Props = {
  slug: string;
  members: MemberRow[];
};

export function CollectionMembershipEditor({ slug, members: initial }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [members, setMembers] = useState(initial);
  // After a save, the server page re-renders with the new list: adopt it (React's "reset state on prop change" pattern).
  const initialSig = initial.map((m) => m.product_id).join(",");
  const [seenSig, setSeenSig] = useState(initialSig);
  if (initialSig !== seenSig) {
    setSeenSig(initialSig);
    setMembers(initial);
  }
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; handle: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const orderedIds = useMemo(() => members.map((m) => m.product_id), [members]);

  async function searchProducts() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(search.trim())}`);
      if (!res.ok) {
        setErr("Search failed — try again.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setResults(Array.isArray(data.products) ? data.products : []);
    } catch {
      setErr("Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addById(productId: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addProductIds: [productId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || "Add failed");
        return;
      }
      setMsg("Product added.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(productId: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeProductIds: [productId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.message || `Could not remove the product (${res.status}). Nothing was changed.`);
        return;
      }
      setMembers((m) => m.filter((x) => x.product_id !== productId));
      setMsg("Product removed from the collection.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function move(productId: string, dir: -1 | 1) {
    const idx = members.findIndex((m) => m.product_id === productId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= members.length) return;
    const next = [...members];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setMembers(next);
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedProductIds: next.map((m) => m.product_id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMembers(members);
        setErr(data.message || `Could not save the new order (${res.status}). The previous order is kept.`);
        return;
      }
      setMsg("Order saved.");
      router.refresh();
    } catch {
      setMembers(members);
      setErr("Network error: the new order was not saved.");
    } finally {
      setBusy(false);
    }
  }

  const [pasteId, setPasteId] = useState("");

  return (
    <section data-testid="collection-membership" className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Products in collection</h2>
      <p className="mt-1 text-sm text-[var(--adm-ink-2)]">{orderedIds.length} {orderedIds.length === 1 ? "product" : "products"} · customers see them in this order. Use Up and Down to change it.</p>

      <ul className="mt-4 divide-y divide-[var(--adm-divider)]">
        {members.map((m, i) => (
          <li key={m.product_id} data-testid="collection-member" className="flex flex-wrap items-center gap-2 py-3 text-sm">
            <span className="w-8 text-[var(--adm-ink-2)]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.products?.title || m.product_id}
                {m.products?.status !== "active" ? (
                  <span className="ml-2 rounded bg-[var(--adm-surface-2)] px-1.5 py-0.5 text-xs font-semibold text-[var(--adm-ink-2)]">
                    {m.products ? `${m.products.status} — not shown` : "deleted — not shown"}
                  </span>
                ) : null}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                {m.products?.handle}
              </p>
            </div>
            <button
              type="button"
              disabled={!hydrated || busy || i === 0}
              onClick={() => move(m.product_id, -1)}
              aria-label={`Move ${m.products?.title || "product"} up`}
              className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              disabled={!hydrated || busy || i === members.length - 1}
              onClick={() => move(m.product_id, 1)}
              aria-label={`Move ${m.products?.title || "product"} down`}
              className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              disabled={!hydrated || busy}
              onClick={() => remove(m.product_id)}
              aria-label={`Remove ${m.products?.title || "product"} from the collection`}
              className="rounded border border-[var(--adm-danger)] px-2 py-1 text-xs font-semibold text-[var(--adm-danger)] disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-sm">
          <span className="font-medium">Or add by product ID (advanced)</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs"
            value={pasteId}
            onChange={(e) => setPasteId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!hydrated || busy || !pasteId.trim()}
            onClick={() => addById(pasteId.trim())}
            className="rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[180px] flex-1 rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm"
          placeholder="Search by name, address or SKU"
          aria-label="Search products to add"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          disabled={!hydrated || busy || !search.trim()}
          onClick={searchProducts}
          className="rounded-lg border border-[var(--adm-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Search
        </button>
      </div>
      {results.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span>
                {r.title}{" "}
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">{r.handle}</span>
              </span>
              <button
                type="button"
                disabled={!hydrated || busy || orderedIds.includes(r.id)}
                aria-label={`Add ${r.title} to the collection`}
                className="font-semibold text-[var(--adm-action)] disabled:opacity-40"
                onClick={() => addById(r.id)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {msg ? (
        <p className="mt-3 text-sm text-[var(--adm-success)]" role="status" data-testid="collection-membership-msg">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
