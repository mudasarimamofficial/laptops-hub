"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import {
  DEFAULT_CONTACT_SOCIAL,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  fillWhatsAppTemplate,
  type ContactSocialSettings,
  type ContactPhone,
  type SocialLink,
} from "@/lib/content/contact-social";

type Props = { initial: ContactSocialSettings };

export function ContactSocialForm({ initial }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [s, setS] = useState<ContactSocialSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function setWhatsApp<K extends keyof ContactSocialSettings["whatsapp"]>(key: K, value: ContactSocialSettings["whatsapp"][K]) {
    setS((prev) => ({ ...prev, whatsapp: { ...prev.whatsapp, [key]: value } }));
  }

  function updatePhone(i: number, patch: Partial<ContactPhone>) {
    setS((prev) => ({
      ...prev,
      phones: prev.phones.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  }

  function updateSocial(i: number, patch: Partial<SocialLink>) {
    setS((prev) => ({
      ...prev,
      social: prev.social.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    }));
  }

  const preview = fillWhatsAppTemplate(s.whatsapp.messageTemplate || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE, {
    business_name: s.businessName,
    product_name: "Dell Latitude 5400",
    variant_label: "8GB / 256GB",
    configuration: "Core i5 · 8GB · 256GB SSD",
    sku: "DEMO-SKU",
    quantity: "1",
    unit_price: "Rs 49,000",
    subtotal: "Rs 49,000",
    product_url: "https://www.laptopshub.pk/products/example",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactSocial: s }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Contact & social settings saved.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="contact-social"
      method="post"
      onSubmit={onSubmit}
      className="mt-8 space-y-5 scroll-mt-24 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Contact &amp; Social</h2>
        <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
          Public footer contacts, social links, floating WhatsApp widget, and product-page WhatsApp ordering. Defaults
          match the verified Bahawalpur business details.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Business &amp; contact</legend>
        <label className="block text-sm">
          Business display name
          <input className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.businessName} onChange={(e) => setS({ ...s, businessName: e.target.value })} />
        </label>
        <label className="block text-sm">
          Full address
          <textarea className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" rows={3} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
        </label>
        <label className="block text-sm">
          Contact email
          <input type="email" className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} />
        </label>
        <div className="space-y-3">
          <p className="text-sm font-medium">Telephone numbers</p>
          {s.phones.map((p, i) => (
            <div key={p.id} className="grid gap-2 rounded-lg border border-[var(--adm-border)] p-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs">
                Display
                <input className="mt-1 w-full rounded-md border border-[var(--adm-border)] px-2 py-1.5 text-sm" value={p.display} onChange={(e) => updatePhone(i, { display: e.target.value })} />
              </label>
              <label className="text-xs">
                tel: digits
                <input className="mt-1 w-full rounded-md border border-[var(--adm-border)] px-2 py-1.5 text-sm" value={p.tel} onChange={(e) => updatePhone(i, { tel: e.target.value.replace(/\s+/g, "") })} />
              </label>
              <label className="flex items-center gap-2 text-sm md:mt-5">
                <input type="checkbox" checked={p.enabled} onChange={(e) => updatePhone(i, { enabled: e.target.checked })} />
                Show
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-[var(--adm-divider)] pt-4">
        <legend className="font-semibold">Social media</legend>
        <label className="block text-sm">
          Section heading
          <input className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.socialHeading} onChange={(e) => setS({ ...s, socialHeading: e.target.value })} />
        </label>
        {s.social.map((row, i) => (
          <div key={row.id} className="grid gap-2 rounded-lg border border-[var(--adm-border)] p-3 md:grid-cols-[120px_1fr_auto]">
            <span className="text-sm font-medium md:mt-2">{row.label}</span>
            <label className="text-xs">
              HTTPS URL
              <input className="mt-1 w-full rounded-md border border-[var(--adm-border)] px-2 py-1.5 text-sm" value={row.url} onChange={(e) => updateSocial(i, { url: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm md:mt-5">
              <input type="checkbox" checked={row.enabled} onChange={(e) => updateSocial(i, { enabled: e.target.checked })} />
              Show
            </label>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-3 border-t border-[var(--adm-divider)] pt-4">
        <legend className="font-semibold">WhatsApp general chat</legend>
        <label className="block text-sm">
          Business short URL
          <input className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.whatsapp.generalUrl} onChange={(e) => setWhatsApp("generalUrl", e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.whatsapp.widgetEnabled} onChange={(e) => setWhatsApp("widgetEnabled", e.target.checked)} />
          Show floating WhatsApp widget
        </label>
        <label className="block text-sm">
          Widget label
          <input className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.whatsapp.widgetLabel} onChange={(e) => setWhatsApp("widgetLabel", e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.whatsapp.showOnMobile} onChange={(e) => setWhatsApp("showOnMobile", e.target.checked)} />
            Mobile
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.whatsapp.showOnDesktop} onChange={(e) => setWhatsApp("showOnDesktop", e.target.checked)} />
            Desktop
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-[var(--adm-divider)] pt-4">
        <legend className="font-semibold">WhatsApp product ordering</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.whatsapp.orderingEnabled} onChange={(e) => setWhatsApp("orderingEnabled", e.target.checked)} />
          Show “Order on WhatsApp” on product pages
        </label>
        <label className="block text-sm">
          CTA label
          <input className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.whatsapp.ctaLabel} onChange={(e) => setWhatsApp("ctaLabel", e.target.value)} />
        </label>
        <label className="block text-sm">
          Verified WhatsApp recipient (international digits, no +)
          <input
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2"
            value={s.whatsapp.recipientDigits}
            onChange={(e) => setWhatsApp("recipientDigits", e.target.value.replace(/\D/g, ""))}
            placeholder="923XXXXXXXXX"
          />
          <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">
            Required for automatic prefilled wa.me messages. Leave blank to use copy/open fallback with the Business short
            link. Do not assume public phone numbers are WhatsApp-enabled.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.whatsapp.soldOutInquiryEnabled} onChange={(e) => setWhatsApp("soldOutInquiryEnabled", e.target.checked)} />
          Show sold-out inquiry CTA
        </label>
        <label className="block text-sm">
          Sold-out CTA label
          <input className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2" value={s.whatsapp.soldOutCtaLabel} onChange={(e) => setWhatsApp("soldOutCtaLabel", e.target.value)} />
        </label>
        <label className="block text-sm">
          Message template
          <textarea className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs" rows={12} value={s.whatsapp.messageTemplate} onChange={(e) => setWhatsApp("messageTemplate", e.target.value)} />
        </label>
        <p className="text-xs text-[var(--adm-ink-2)]">
          Variables: {"{{business_name}} {{product_name}} {{variant_label}} {{configuration}} {{sku}} {{quantity}} {{unit_price}} {{subtotal}} {{product_url}}"}
        </p>
        <details className="rounded-lg border border-[var(--adm-border)] p-3 text-sm">
          <summary className="cursor-pointer font-medium">Message preview (sample product)</summary>
          <pre className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink)]">{preview}</pre>
        </details>
        <button
          type="button"
          className="text-sm font-semibold text-[var(--adm-action)]"
          onClick={() => setS(DEFAULT_CONTACT_SOCIAL)}
        >
          Reset form to merchant defaults
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={!hydrated || busy}
        className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save contact & social"}
      </button>
      {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </form>
  );
}
