"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "@/lib/commerce/compare-store";

export function CompareTray() {
  const pathname = usePathname();
  const handles = useCompare((s) => s.handles);
  const clear = useCompare((s) => s.clear);

  if (handles.length === 0) return null;
  if (pathname?.startsWith("/admin") || pathname === "/checkout") return null;
  // Hide over product story so CTAs stay reachable
  if (pathname === "/") {
    /* still show on home but keep compact bottom bar — story uses high z sticky */
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-30 flex w-[min(920px,calc(100%-24px))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[var(--lh-border)] bg-white/95 px-4 py-3 shadow-[0_20px_50px_-24px_rgba(10,23,48,.45)] backdrop-blur">
      <p className="text-sm font-semibold text-[var(--lh-ink)]">
        Comparing {handles.length}/4
        <span className="ml-2 font-normal text-[var(--lh-ink-2)]">{handles.join(", ")}</span>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="rounded-full px-3 py-2 text-sm text-[var(--lh-ink-2)]">
          Clear
        </button>
        <Link href="/compare" className="lh-btn lh-btn-primary !py-2 !text-sm">
          Open compare
        </Link>
      </div>
    </div>
  );
}
