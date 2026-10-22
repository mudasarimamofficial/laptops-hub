"use client";

import { useToast } from "@/lib/commerce/toast";

export function Toast() {
  const toast = useToast();
  return (
    <>
      <div role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {toast}
      </div>
      {toast ? (
        <div
          aria-hidden="true"
          style={{ position: "fixed", left: "50%", top: 88, transform: "translateX(-50%)", zIndex: 99, display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderRadius: 999, background: "rgba(var(--lh-navy-rgb),.9)", border: "1px solid rgba(var(--lh-electric-rgb),.35)", color: "#FFFFFF", fontSize: 14, fontWeight: 600, boxShadow: "0 12px 30px -10px rgba(0,0,0,.5)" }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lh-electric)", boxShadow: "0 0 10px var(--lh-electric)" }} />
          {toast}
        </div>
      ) : null}
    </>
  );
}
