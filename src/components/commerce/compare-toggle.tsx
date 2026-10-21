"use client";

import { useCompare, COMPARE_MAX } from "@/lib/commerce/compare-store";

export function CompareToggle({ handle }: { handle: string }) {
  const toggle = useCompare((s) => s.toggle);
  const has = useCompare((s) => s.has(handle));
  const count = useCompare((s) => s.handles.length);

  return (
    <button
      type="button"
      className="rounded-[var(--lh-radius-pill)] border border-[var(--lh-border)] px-5 py-3 text-sm font-semibold"
      onClick={() => toggle(handle)}
      disabled={!has && count >= COMPARE_MAX}
      aria-pressed={has}
    >
      {has ? "In compare" : "Compare"}
    </button>
  );
}
