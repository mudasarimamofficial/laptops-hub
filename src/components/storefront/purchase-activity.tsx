"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { activityText, type ActivityItem, type SocialProofSettings } from "@/lib/content/social-proof";

const QUIET_PATHS = ["/checkout", "/cart", "/order", "/track-order"];
const SESSION_KEY = "lh-activity";

type Session = { shown: number; dismissed: boolean };

function readSession(): Session {
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    return { shown: Number(v.shown) || 0, dismissed: v.dismissed === true };
  } catch {
    return { shown: 0, dismissed: false };
  }
}
function writeSession(s: Session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the in-memory limits below still apply */
  }
}

/**
 * Small bottom-corner "a customer ordered …" notice. Renders nothing unless the merchant switched it on AND the server
 * returned real qualifying orders. Never on checkout/cart/order pages, stops for the session once dismissed, limited
 * per session, pauses while the tab is hidden, and appears without motion for reduced-motion users.
 */
export function PurchaseActivity({ config }: { config: SocialProofSettings["activity"] }) {
  const pathname = usePathname() || "/";
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [current, setCurrent] = useState<ActivityItem | null>(null);
  const idx = useRef(0);
  const stopped = useRef(false);

  useEffect(() => {
    if (!config.enabled) return;
    const s = readSession();
    if (s.dismissed || s.shown >= config.maxPerSession) return;
    const ctrl = new AbortController();
    // Wait until the page has settled so the notice never competes with the first paint.
    const t = window.setTimeout(() => {
      fetch("/api/activity/recent", { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: ActivityItem[] }) => setItems(Array.isArray(d.items) ? d.items : []))
        .catch(() => setItems([]));
    }, 6000);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [config.enabled, config.maxPerSession]);

  useEffect(() => {
    if (!items.length || quiet) return;
    let hideTimer = 0;
    const show = () => {
      if (stopped.current || document.hidden) return;
      const s = readSession();
      if (s.dismissed || s.shown >= config.maxPerSession) {
        stopped.current = true;
        return;
      }
      setCurrent(items[idx.current % items.length]);
      idx.current += 1;
      writeSession({ ...s, shown: s.shown + 1 });
      hideTimer = window.setTimeout(() => setCurrent(null), config.displaySeconds * 1000);
    };
    const first = window.setTimeout(show, 2000);
    const every = window.setInterval(show, config.intervalSeconds * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.clearTimeout(hideTimer);
      setCurrent(null);
    };
  }, [items, quiet, config.displaySeconds, config.intervalSeconds, config.maxPerSession]);

  if (!current || quiet) return null;
  const side = config.position === "bottom-right" ? { right: 16 } : { left: 16 };
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="purchase-activity"
      className="lh-activity"
      style={{ position: "fixed", bottom: 16, ...side, zIndex: 60, maxWidth: "min(360px, calc(100vw - 32px))", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 16, background: "#FFFFFF", border: "1px solid var(--lh-border)", boxShadow: "0 18px 40px -18px rgba(10,23,48,.35)", fontFamily: "var(--font-body)", color: "var(--lh-ink)" }}
    >
      {current.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- catalog CDN thumbnail
        <img src={current.imageUrl} alt="" width={48} height={48} loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, background: "var(--lh-ice)", flexShrink: 0 }} />
      ) : null}
      <Link href={`/products/${encodeURIComponent(current.handle)}`} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none", fontSize: 13, lineHeight: 1.4 }}>
        {activityText(current)}
      </Link>
      <button
        type="button"
        aria-label="Hide recent order notices"
        onClick={() => {
          writeSession({ ...readSession(), dismissed: true });
          stopped.current = true;
          setCurrent(null);
        }}
        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: 0, background: "transparent", color: "var(--lh-ink-2)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
