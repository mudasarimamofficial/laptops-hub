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
      // Reuse products list page data via lightweight fetch of admin products API would be better;
      // until dedicated search endpoint, hit storefront catalog search is wrong for drafts.
      // Use a temporary client call to collections GET after mutations; for search, call products table via export of handles is overkill.
      const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(search.trim())}`);
      if (res.status === 404) {
        setErr("Product search endpoint not available yet — paste a product UUID below or open the product and assign later.");
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
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeProductIds: [productId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.message || "Remove failed");
        return;
      }
      setMembers((m) => m.filter((x) => x.product_id !== productId));
      setMsg("Removed.");
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
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedProductIds: next.map((m) => m.product_id) }),
      });
      if (!res.ok) {
        setMembers(members);
        setErr("Reorder failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const [pasteId, setPasteId] = useState("");

  return (
    <section className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Products in collection</h2>
      <p className="mt-1 text-sm text-[var(--adm-ink-2)]">{orderedIds.length} products · drag alternatives via Up/Down</p>

      <ul className="mt-4 divide-y divide-[var(--adm-divider)]">
        {members.map((m, i) => (
          <li key={m.product_id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
            <span className="w-8 text-[var(--adm-ink-2)]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.products?.title || m.product_id}</p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                {m.products?.handle}
              </p>
            </div>
            <button
              type="button"
              disabled={!hydrated || busy || i === 0}
              onClick={() => move(m.product_id, -1)}
              className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              disabled={!hydrated || busy || i === members.length - 1}
              onClick={() => move(m.product_id, 1)}
              className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              disabled={!hydrated || busy}
              onClick={() => remove(m.product_id)}
              className="rounded border border-[var(--adm-danger)] px-2 py-1 text-xs font-semibold text-[var(--adm-danger)] disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-sm">
          <span className="font-medium">Add by product UUID</span>
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
            className="rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[180px] flex-1 rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm"
          placeholder="Search title (when search API is live)"
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
              <button type="button" className="text-[var(--lh-action)] font-semibold" onClick={() => addById(r.id)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {msg ? <p className="mt-3 text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
