"use client";

import { useEffect, useState } from "react";
import { useCartUi } from "@/lib/commerce/cart-ui";
import { useCompare } from "@/lib/commerce/compare-store";
import { IconWhatsApp } from "@/components/storefront/social-icons";
import type { WhatsAppSettings } from "@/lib/content/contact-social";

export function WhatsAppFloat({ settings }: { settings: WhatsAppSettings }) {
  const cartOpen = useCartUi((s) => s.open);
  const compareCount = useCompare((s) => s.handles.length);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 759.98px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!settings.widgetEnabled || !settings.generalUrl) return null;
  if (narrow && !settings.showOnMobile) return null;
  if (!narrow && !settings.showOnDesktop) return null;
  if (cartOpen) return null;

  const label = settings.widgetLabel?.trim() || "Chat on WhatsApp";
  const bottom = compareCount > 0 ? "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" : "max(1.25rem, env(safe-area-inset-bottom))";

  return (
    <a
      href={settings.generalUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-float"
      aria-label={`${label} — opens in a new tab`}
      className="v5-hov-bright"
      style={{
        position: "fixed",
        right: "max(1rem, env(safe-area-inset-right))",
        bottom,
        zIndex: 35,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minHeight: 52,
        padding: settings.widgetLabel ? "0 16px 0 12px" : 0,
        width: settings.widgetLabel ? "auto" : 52,
        justifyContent: "center",
        borderRadius: 999,
        // WhatsApp dark green: white text needs ≥4.5:1 (WCAG AA); #25D366 was 1.98:1, #075E54 is 7.67:1 (LH-026).
        background: "#075E54",
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: 14,
        boxShadow: "0 14px 32px -14px rgba(0,0,0,.55)",
        textDecoration: "none",
        transition: "transform .18s ease, bottom .2s ease",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,.18)",
          flexShrink: 0,
        }}
      >
        <IconWhatsApp size={22} />
      </span>
      {settings.widgetLabel ? <span className="v5-d-only">{label}</span> : null}
    </a>
  );
}
