"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { useDialog } from "@/components/storefront/v5/use-dialog";
import type { V5SearchHit } from "@/lib/catalog/v5-model";

/** V5 `suggest` chips. */
const SUGGEST = ["ThinkPad", "Latitude", "EliteBook", "MacBook", "Charger", "i7"];

type Props = { open: boolean; onClose: () => void };

/** V5 search overlay (`sOpen`): glass sheet, live results (6), "See all N results", Enter → /search. */
export function SearchOverlay({ open, onClose }: Props) {
  if (!open) return null;
  return <SearchSheet onClose={onClose} />;
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ q: string; results: V5SearchHit[]; total: number } | null>(null);
  useDialog(true, sheetRef, onClose, inputRef);

  const term = q.trim();
  useEffect(() => {
    if (!term) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/catalog/search?q=${encodeURIComponent(term)}&limit=6`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { results: V5SearchHit[]; total: number }) => setRes({ q: term, results: d.results || [], total: d.total || 0 }))
        .catch(() => {
          /* aborted or offline: keep the previous results */
        });
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const current = res && res.q === term ? res : null;
  const results = term && current ? current.results : [];
  const total = term && current ? current.total : 0;
  const submit = () => {
    if (!term) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(var(--lh-navy-rgb),.4)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 80 }} />
      <div
        ref={sheetRef}
        data-lh-dialog="1"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 81, background: "var(--lh-glass)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid var(--lh-border)", boxShadow: "0 30px 60px -30px rgba(var(--lh-navy-rgb),.5)", maxHeight: "90vh", overflow: "auto", color: "var(--lh-ink)" }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px clamp(16px,3vw,32px) 30px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 62, padding: "0 8px 0 18px", borderRadius: 999, background: "var(--lh-paper)", border: "1px solid var(--lh-action)", boxShadow: "0 0 0 4px rgba(var(--lh-action-rgb),.12)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1CB9E8" strokeWidth="2" aria-hidden="true">
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
              placeholder="Try “T490”, “i7 16GB” or “touch”"
              aria-label="Search laptops"
              style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: "none", fontSize: 19, background: "transparent", color: "var(--lh-ink)" }}
            />
            {term ? (
              <button type="button" onClick={() => setQ("")} style={{ border: 0, background: "transparent", fontSize: 13, fontWeight: 700, color: "var(--lh-ink-2)", cursor: "pointer", padding: 8 }}>
                Clear
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close search" style={{ width: 44, height: 44, border: 0, borderRadius: "50%", background: "var(--lh-ice)", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {!term ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-ink-2)" }}>Popular</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUGGEST.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="v5-hov-bd-action"
                    onClick={() => {
                      setQ(s);
                      inputRef.current?.focus();
                    }}
                    style={{ height: 38, padding: "0 16px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "var(--lh-paper)", fontSize: 14, cursor: "pointer", color: "var(--lh-ink)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-live="polite">
              {results.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={onClose}
                  className="v5-hov-ice"
                  style={{ display: "grid", gridTemplateColumns: "76px minmax(0,1fr) auto", gap: 14, alignItems: "center", padding: 10, margin: "0 -10px", borderRadius: 14, color: "var(--lh-ink)" }}
                >
                  <span style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, overflow: "hidden", background: "#FFFFFF", border: "1px solid var(--lh-border)" }}>
                    <LHImg src={r.img} alt="" pad="3px" eager />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{r.model}</span>
                    <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>{r.config}</span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>{r.priceText}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-ink-2)" }}>{r.stock}</span>
                  </span>
                </Link>
              ))}
              {current && !total ? <span style={{ padding: "20px 0", fontSize: 15, color: "var(--lh-ink-2)" }}>No laptops match “{q}”.</span> : null}
              {total > 6 ? (
                <button
                  type="button"
                  onClick={submit}
                  style={{ marginTop: 12, alignSelf: "flex-start", height: 44, padding: "0 20px", border: 0, borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  <span>See all {total} results</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
