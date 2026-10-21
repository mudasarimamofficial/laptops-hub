"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPkr } from "@/lib/money";

type Result = {
  handle: string;
  title: string;
  model: string;
  config: string;
  pricePaisa: number;
  imageUrl?: string;
};

const POPULAR = ["Dell Latitude", "ThinkPad", "16GB", "i7", "Chromebook", "touch"];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(term)}&limit=8`);
        const data = (await res.json()) as { products?: Result[]; total?: number };
        if (cancelled) return;
        setResults(data.products || []);
        setTotal(data.total ?? data.products?.length ?? 0);
      } catch {
        if (!cancelled) {
          setResults([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, open]);

  const submit = useCallback(() => {
    const term = q.trim();
    if (!term) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }, [q, onClose, router]);

  if (!open) return null;

  const hasQ = q.trim().length > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-[rgba(10,23,48,.4)] backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 top-0 z-[81] max-h-[90vh] overflow-auto border-b border-[var(--lh-border)] bg-[rgba(247,250,255,.92)] text-[var(--lh-ink)] shadow-[0_30px_60px_-30px_rgba(10,23,48,.5)] backdrop-blur-[24px]"
      >
        <h2 id={titleId} className="sr-only">
          Search
        </h2>
        <div className="mx-auto flex max-w-[900px] flex-col gap-5 px-[clamp(16px,3vw,32px)] pb-[30px] pt-5">
          <div className="flex h-[62px] items-center gap-3 rounded-full border border-[var(--lh-action)] bg-white py-0 pl-[18px] pr-2 shadow-[0_0_0_4px_rgba(33,89,212,.12)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1CB9E8" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder='Try “T490”, “i7 16GB” or “touch”'
              aria-label="Search laptops"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-[19px] text-[var(--lh-ink)] outline-none"
            />
            {hasQ ? (
              <button
                type="button"
                className="px-2 text-[13px] font-bold text-[var(--lh-ink-2)]"
                onClick={() => setQ("")}
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close search"
              className="grid h-11 w-11 place-items-center rounded-full bg-[var(--lh-ice)]"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {!hasQ ? (
            <div className="flex flex-col gap-3">
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--lh-ink-2)]">
                Popular
              </span>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="h-[38px] rounded-full border border-[var(--lh-border)] bg-white px-4 text-sm text-[var(--lh-ink)] hover:border-[var(--lh-action)]"
                    onClick={() => setQ(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {loading && results.length === 0 ? (
                <span className="py-5 text-[15px] text-[var(--lh-ink-2)]">Searching…</span>
              ) : null}
              {results.map((r) => (
                <Link
                  key={r.handle}
                  href={`/products/${r.handle}`}
                  onClick={onClose}
                  className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[14px] p-2.5 text-[var(--lh-ink)] hover:bg-[var(--lh-ice)]"
                >
                  <span className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-[var(--lh-border)] bg-white">
                    {r.imageUrl ? (
                      <Image src={r.imageUrl} alt="" fill className="object-contain p-1" sizes="76px" unoptimized />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold">{r.model}</span>
                    <span className="truncate text-[13px] text-[var(--lh-ink-2)]">{r.config}</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="font-[family-name:var(--font-display)] text-[15px] font-bold">
                      {formatPkr(r.pricePaisa)}
                    </span>
                  </span>
                </Link>
              ))}
              {!loading && results.length === 0 ? (
                <span className="py-5 text-[15px] text-[var(--lh-ink-2)]">No laptops match “{q.trim()}”.</span>
              ) : null}
              {total > results.length ? (
                <button
                  type="button"
                  onClick={submit}
                  className="mt-3 h-11 self-start rounded-full bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-5 text-sm font-bold text-white"
                >
                  See all {total} results
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
