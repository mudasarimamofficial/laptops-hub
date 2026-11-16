"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StaffRole } from "@/lib/auth/staff";
import { formatPkr } from "@/lib/money";
import type { AdminSearchResult } from "@/lib/admin/search-term";
import { ADMIN_NAV, navVisibleForRole } from "./nav";

type Item = { id: string; group: "Go to" | "Products" | "Orders"; label: string; detail: string; href: string };

/** Admin sections this role may open, flattened (top-level items and their children). */
function sectionsFor(role: StaffRole | null): Item[] {
  const out: Item[] = [];
  for (const section of ADMIN_NAV)
    for (const item of section.items) {
      if (!navVisibleForRole(item, role)) continue;
      out.push({ id: `nav:${item.href}`, group: "Go to", label: item.label, detail: section.label, href: item.href });
      for (const c of item.children || [])
        if (c.href !== item.href && navVisibleForRole(c, role)) out.push({ id: `nav:${c.href}`, group: "Go to", label: c.label, detail: item.label, href: c.href });
    }
  return out;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/**
 * Global admin search: Ctrl/⌘ K (anywhere) or "/" (outside a text field) opens it; ↑/↓ choose, Enter opens, Esc
 * closes. Sections come from the role-filtered navigation; products and orders from /api/admin/search, which applies
 * the same role rules on the server.
 */
export function AdminSearch({ role }: { role: StaffRole | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<AdminSearchResult>({ products: [], orders: [] });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();
  const sections = useMemo(() => sectionsFor(role), [role]);

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setRemote({ products: [], orders: [] });
    setActive(0);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      } else if (e.key === "/" && !open && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const term = q.trim();
  useEffect(() => {
    if (!open || term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        setRemote(await res.json());
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, term]);

  const items: Item[] = useMemo(() => {
    const needle = term.toLowerCase();
    const nav = needle ? sections.filter((s) => `${s.label} ${s.detail}`.toLowerCase().includes(needle)).slice(0, 6) : sections.slice(0, 8);
    if (term.length < 2) return nav;
    return [
      ...nav,
      ...remote.products.map((p) => ({ id: `p:${p.handle}`, group: "Products" as const, label: p.title, detail: [p.status, p.sku].filter(Boolean).join(" · "), href: `/admin/products/${encodeURIComponent(p.handle)}` })),
      ...remote.orders.map((o) => ({ id: `o:${o.orderNumber}`, group: "Orders" as const, label: o.orderNumber, detail: `${o.status} · ${o.paymentStatus} · ${formatPkr(o.totalDuePaisa)}`, href: `/admin/orders/${encodeURIComponent(o.orderNumber)}` })),
    ];
  }, [term, sections, remote]);
  const current = Math.min(active, Math.max(0, items.length - 1));

  const go = (it: Item | undefined) => {
    if (!it) return;
    close();
    router.push(it.href);
  };
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) setActive((current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[current]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-sm text-[var(--adm-ink-2)] hover:border-[var(--lh-action)] sm:w-64"
        aria-keyshortcuts="Control+K Meta+K /"
        data-testid="admin-search-open"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75" />
          <path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search admin…</span>
        <span className="sr-only sm:hidden">Search admin</span>
        <kbd className="ml-auto hidden rounded border border-[var(--adm-border)] px-1.5 font-[family-name:var(--font-mono)] text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label="Search admin" className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-2xl">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
              aria-autocomplete="list"
              aria-label="Search products, orders and admin sections"
              placeholder="Product, SKU, order number, phone or section…"
              className="h-14 w-full border-b border-[var(--adm-border)] bg-transparent px-4 text-base text-[var(--adm-ink)] outline-none"
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
            />
            <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-2" data-testid="admin-search-results">
              {items.map((it, i) => (
                <li
                  key={it.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  data-group={it.group}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={`flex cursor-pointer items-baseline gap-3 px-4 py-2 text-sm ${i === current ? "bg-[var(--lh-ice)] text-[var(--adm-ink)]" : "text-[var(--adm-ink)]"}`}
                >
                  <span className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--adm-ink-2)]">{it.group}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
                  <span className="shrink-0 truncate text-xs text-[var(--adm-ink-2)]">{it.detail}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--adm-border)] px-4 py-2 text-xs text-[var(--adm-ink-2)]" role="status" aria-live="polite">
              {failed
                ? "Search is not available right now. Try again."
                : loading
                  ? "Searching…"
                  : term.length >= 2 && items.length === 0
                    ? `Nothing found for “${term}”.`
                    : "↑ ↓ to choose · Enter to open · Esc to close"}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
