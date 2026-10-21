"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare, COMPARE_MAX } from "@/lib/commerce/compare-store";
import { useCartUi } from "@/lib/commerce/cart-ui";
import { isValidHandle } from "@/lib/catalog/handles";

type Item = { handle: string; title: string; model: string; imageUrl: string | null; imageAlt: string };

/** Module cache shared across mounts: handle → summary, or null when the handle is not public. */
const cache = new Map<string, Item | null>();

/** Same exclusions as V5 (compare/page/guides/cart) plus admin and checkout. */
const HIDDEN_ROUTES = [/^\/admin/, /^\/checkout/, /^\/compare/, /^\/cart/, /^\/pages\//, /^\/guides/];

function useStoryInView(active: boolean) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById("story");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [active]);
  return active && inView;
}

export function CompareTray() {
  const pathname = usePathname() || "/";
  const handles = useCompare((s) => s.handles);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const drawerOpen = useCartUi((s) => s.open);
  const storyIn = useStoryInView(pathname === "/");
  const [, setTick] = useState(0);
  const key = handles.join(",");

  useEffect(() => {
    // Drop malformed persisted values before asking the server.
    const invalid = handles.filter((h) => !isValidHandle(h));
    invalid.forEach((h) => remove(h));
    const missing = handles.filter((h) => isValidHandle(h) && !cache.has(h));
    if (!missing.length) return;
    const ctrl = new AbortController();
    fetch(`/api/catalog/compare-summary?handles=${encodeURIComponent(missing.join(","))}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { items: Item[]; requested: string[] }) => {
        const got = new Map(j.items.map((i) => [i.handle, i]));
        for (const h of j.requested) cache.set(h, got.get(h) ?? null);
        // Handles the public catalog no longer returns (draft, archived, deleted, unpurchasable): prune.
        for (const h of j.requested) if (!got.has(h)) remove(h);
        setTick((n) => n + 1);
      })
      .catch(() => {
        /* Network/API failure: keep selections; tray falls back to text labels. */
      });
    return () => ctrl.abort();
    // `remove` is recreated every render by the store hook; the handle list is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (handles.length === 0) return null;
  if (HIDDEN_ROUTES.some((r) => r.test(pathname)) || drawerOpen || storyIn) return null;

  const rows = handles.map((h) => ({ h, item: cache.get(h) }));
  const shown = rows.filter((r) => r.item !== null);
  if (!shown.length) return null;
  const names = shown.map((r) => r.item?.model).filter(Boolean).join(", ");

  return (
    <aside
      aria-label="Comparison"
      className="fixed bottom-[max(18px,env(safe-area-inset-bottom))] left-1/2 z-30 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 rounded-full border border-[rgba(28,185,232,.35)] bg-[rgba(10,23,48,.82)] py-2 pl-3.5 pr-2 text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.6),0_0_24px_-8px_rgba(28,185,232,.5)] backdrop-blur-md"
    >
      <ul className="m-0 flex list-none gap-1.5 p-0">
        {shown.map(({ h, item }) => {
          const label = item?.model || "Selected product";
          return (
            <li key={h} className="relative">
              <span className="relative block h-[33px] w-[44px] overflow-hidden rounded-lg bg-white">
                {item?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={label} className="h-full w-full object-contain p-0.5" decoding="async" />
                ) : (
                  <span className="sr-only">{label}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove(h)}
                aria-label={`Remove ${label} from comparison`}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[12px] font-bold leading-none text-[var(--lh-ink)] shadow after:absolute after:-inset-3 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lh-electric)]"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          );
        })}
      </ul>
      {names ? <span className="hidden max-w-[260px] truncate text-[13px] text-white/80 lg:inline">{names}</span> : null}
      <span aria-live="polite" className="whitespace-nowrap font-[family-name:var(--font-mono)] text-xs text-white/75">
        {shown.length}/{COMPARE_MAX}
      </span>
      <button
        type="button"
        onClick={clear}
        className="h-[42px] whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-white/80 hover:text-white"
      >
        Clear all
      </button>
      <Link
        href="/compare"
        className="flex h-[42px] items-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-5 text-sm font-bold text-white"
      >
        Compare
      </Link>
    </aside>
  );
}
