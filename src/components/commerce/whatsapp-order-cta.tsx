"use client";

import { useId, useRef, useState } from "react";
import { IconWhatsApp } from "@/components/storefront/social-icons";
import { fillWhatsAppTemplate, waMeOrderUrl, type WhatsAppSettings } from "@/lib/content/contact-social";
import { useDialog } from "@/components/storefront/v5/use-dialog";

type Props = {
  businessName: string;
  productName: string;
  variantLabel: string;
  configuration: string;
  sku: string | null;
  quantity: number;
  unitPriceText: string;
  subtotalText: string;
  productUrl: string;
  whatsapp: WhatsAppSettings;
  /** Sold-out inquiry mode uses soldOutCtaLabel and does not claim stock. */
  mode: "order" | "inquire";
  disabled?: boolean;
  disabledReason?: string;
};

export function WhatsAppOrderCta(p: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(open, dialogRef, () => setOpen(false));

  const label = p.mode === "inquire" ? p.whatsapp.soldOutCtaLabel : p.whatsapp.ctaLabel;
  const orderMessage = fillWhatsAppTemplate(p.whatsapp.messageTemplate, {
    business_name: p.businessName,
    product_name: p.productName,
    variant_label: p.variantLabel,
    configuration: p.configuration,
    sku: p.sku || "",
    quantity: String(p.quantity),
    unit_price: p.unitPriceText,
    subtotal: p.subtotalText,
    product_url: p.productUrl,
  });
  const message =
    p.mode === "inquire"
      ? `Hello ${p.businessName}! 👋

I am checking availability for this product (it appears sold out on the website — this is an inquiry only, not an order).

Product: ${p.productName}
Variant: ${p.variantLabel || "—"}
Configuration: ${p.configuration || "—"}
SKU: ${p.sku || "—"}
Listed unit price: ${p.unitPriceText}

Product link:
${p.productUrl}

Please let me know if this option (or a similar configuration) is available. Thank you!`
      : orderMessage;

  const prefilled = waMeOrderUrl(p.whatsapp.recipientDigits, message);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function onClick() {
    if (p.disabled) return;
    if (prefilled) {
      window.open(prefilled, "_blank", "noopener,noreferrer");
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        data-testid="pdp-whatsapp-cta"
        data-wa-mode={p.mode}
        data-wa-prefilled={prefilled ? "1" : "0"}
        disabled={p.disabled}
        aria-disabled={p.disabled || undefined}
        title={p.disabled ? p.disabledReason : undefined}
        onClick={onClick}
        className="v5-hov-bright"
        style={{
          width: "100%",
          minHeight: 48,
          borderRadius: 14,
          border: "1.5px solid #25D366",
          background: "rgba(37,211,102,.08)",
          color: "var(--lh-ink)",
          fontSize: 15,
          fontWeight: 700,
          cursor: p.disabled ? "not-allowed" : "pointer",
          opacity: p.disabled ? 0.55 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <span style={{ color: "#128C7E", display: "grid" }}>
          <IconWhatsApp size={20} />
        </span>
        {label}
      </button>

      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(var(--lh-navy-rgb),.4)", zIndex: 90 }} />
          <div
            ref={dialogRef}
            data-lh-dialog="1"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="whatsapp-message-fallback"
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: "min(520px,92vw)",
              maxHeight: "min(80vh,640px)",
              overflow: "auto",
              zIndex: 91,
              background: "#fff",
              borderRadius: 20,
              border: "1px solid var(--lh-border)",
              boxShadow: "0 28px 60px -28px rgba(var(--lh-navy-rgb),.55)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h2 id={titleId} style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20 }}>
              WhatsApp order message
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--lh-ink-2)", lineHeight: 1.45 }}>
              Copy this message, then open WhatsApp and paste it into the Laptops HUB chat. The message is not sent automatically.
            </p>
            <textarea
              readOnly
              value={message}
              data-testid="whatsapp-message-text"
              rows={12}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 12,
                border: "1px solid var(--lh-border)",
                padding: 12,
                fontSize: 13,
                lineHeight: 1.45,
                fontFamily: "var(--font-mono)",
                color: "var(--lh-ink)",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                data-testid="whatsapp-copy-message"
                onClick={copyMessage}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 999,
                  border: "1px solid var(--lh-border)",
                  background: "var(--lh-ice)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied" : "Copy message"}
              </button>
              <a
                href={p.whatsapp.generalUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="whatsapp-open-general"
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 999,
                  background: "#25D366",
                  color: "#fff",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconWhatsApp size={18} />
                Open WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  minHeight: 44,
                  marginLeft: "auto",
                  padding: "0 14px",
                  borderRadius: 999,
                  border: "1px solid var(--lh-border)",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
