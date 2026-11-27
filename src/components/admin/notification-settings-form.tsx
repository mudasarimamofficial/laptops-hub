"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import type { CustomerMode } from "@/lib/notify/settings";

export type NotificationFormInitial = {
  recipients: string[];
  /** true when the recipients shown come from the saved settings, false = hosting fallback. */
  recipientsSaved: boolean;
  customerMode: CustomerMode;
  inquiryAlerts: boolean;
  orderSubject: string;
  customerSubject: string;
  customerIntro: string;
};

const field = "mt-1 w-full rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-sm";
const button =
  "inline-flex min-h-10 items-center rounded-[var(--adm-radius)] px-4 text-sm font-semibold disabled:opacity-50";

/**
 * G24 Settings › Notifications. Owner/admin only (the page hides it from other roles; the API refuses them).
 * The email provider (key, sender) is read-only here and lives in the hosting settings.
 */
export function NotificationSettingsForm({
  initial,
  providerConfigured,
  sender,
  fallbackRecipients,
  isOwner,
}: {
  initial: NotificationFormInitial;
  providerConfigured: boolean;
  sender: string | null;
  fallbackRecipients: string[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [recipients, setRecipients] = useState(initial.recipientsSaved ? initial.recipients.join("\n") : "");
  const [customerMode, setCustomerMode] = useState<CustomerMode>(initial.customerMode);
  const [inquiryAlerts, setInquiryAlerts] = useState(initial.inquiryAlerts);
  const [orderSubject, setOrderSubject] = useState(initial.orderSubject);
  const [customerSubject, setCustomerSubject] = useState(initial.customerSubject);
  const [customerIntro, setCustomerIntro] = useState(initial.customerIntro);
  const [busy, setBusy] = useState<null | "save" | "test">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = recipients.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const ownerOnlyOn = customerMode === "on" && initial.customerMode !== "on" && !isOwner;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipients: list, customerMode, inquiryAlerts, orderSubject, customerSubject, customerIntro }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.message || "Settings were not saved.");
      else {
        setMsg("Notification settings saved. They apply to new and retried notifications.");
        router.refresh();
      }
    } catch {
      setErr("Network error — settings were not saved.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/notifications/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.message || "The test message was not sent.");
      else setMsg(j.message || "Test message accepted by the email provider.");
    } catch {
      setErr("Network error — the test message was not sent.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form method="post" onSubmit={save} className="space-y-5" data-testid="notification-settings">
      <div className="rounded-lg border border-[var(--adm-divider)] p-3 text-sm" data-testid="notification-provider">
        <p>
          <span className="font-medium">Email provider: </span>
          {providerConfigured ? (
            <span className="text-[var(--adm-success)]">connected</span>
          ) : (
            <span className="text-[var(--adm-warning)]">not connected — nothing is sent until it is set up in the hosting settings</span>
          )}
        </p>
        {sender ? <p className="mt-1 text-[var(--adm-ink-2)]">Sends from: {sender}</p> : null}
        <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
          The provider account, key and sender address are kept in the hosting settings and cannot be changed here.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Staff emails for order and inquiry alerts</span>
        <span className="block text-xs text-[var(--adm-ink-2)]">
          One per line, up to 5.{" "}
          {fallbackRecipients.length
            ? `If left empty, alerts keep going to the address set in the hosting settings (${fallbackRecipients.join(", ")}).`
            : "If left empty, no staff alert can be sent."}
        </span>
        <textarea
          name="recipients"
          rows={3}
          className={field}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={inquiryAlerts} onChange={(e) => setInquiryAlerts(e.target.checked)} />
        <span>
          <span className="font-medium">Email staff about new website inquiries</span>
          <span className="block text-[var(--adm-ink-2)]">The person who wrote in is never emailed. Inquiries always appear in Inquiries.</span>
        </span>
      </label>

      <fieldset className="space-y-2 border-t border-[var(--adm-divider)] pt-4 text-sm">
        <legend className="font-semibold">Customer order emails</legend>
        <p className="text-[var(--adm-ink-2)]">Only customers who gave an email at checkout can receive one.</p>
        {(
          [
            ["off", "Off", "Customers are not emailed."],
            ["test", "Test mode", "The customer email is sent to the staff emails above instead, marked as a test. No customer is emailed."],
            ["on", "On", "Customers receive the confirmation email. Only the owner can turn this on."],
          ] as const
        ).map(([value, label, help]) => (
          <label key={value} className="flex items-start gap-2">
            <input type="radio" name="customerMode" className="mt-1" value={value} checked={customerMode === value} onChange={() => setCustomerMode(value)} />
            <span>
              <span className="font-medium">{label}</span>
              <span className="block text-[var(--adm-ink-2)]">{help}</span>
            </span>
          </label>
        ))}
        {ownerOnlyOn ? (
          <p className="text-[var(--adm-warning)]" role="status">
            Only the owner can turn customer emails on. Saving with this choice will be refused.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 border-t border-[var(--adm-divider)] pt-4 text-sm">
        <legend className="font-semibold">Email wording</legend>
        <p className="text-[var(--adm-ink-2)]">
          Leave a field empty to use the built-in wording. In subjects, {"{order}"} becomes the order number and {"{total}"} the cash due.
          Order details, totals and links are always added automatically.
        </p>
        <label className="block">
          <span className="font-medium">Staff order alert subject</span>
          <input className={field} name="orderSubject" maxLength={150} value={orderSubject} onChange={(e) => setOrderSubject(e.target.value)} placeholder="New COD order {order} — {total}" />
        </label>
        <label className="block">
          <span className="font-medium">Customer email subject</span>
          <input className={field} name="customerSubject" maxLength={150} value={customerSubject} onChange={(e) => setCustomerSubject(e.target.value)} placeholder="Laptops HUB order {order} received" />
        </label>
        <label className="block">
          <span className="font-medium">Customer email introduction</span>
          <span className="block text-xs text-[var(--adm-ink-2)]">Plain text shown after “We have received your order …”. Do not promise delivery times or policies that are not published.</span>
          <textarea className={field} name="customerIntro" rows={3} maxLength={600} value={customerIntro} onChange={(e) => setCustomerIntro(e.target.value)} />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!hydrated || busy !== null} className={`${button} bg-[var(--adm-action)] text-white hover:bg-[var(--adm-action-hover)]`}>
          {busy === "save" ? "Saving…" : "Save notification settings"}
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={!hydrated || busy !== null || !providerConfigured}
          className={`${button} border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-ink)]`}
        >
          {busy === "test" ? "Sending…" : "Send test email to staff"}
        </button>
      </div>
      <p className="text-xs text-[var(--adm-ink-2)]">The test goes to the saved staff emails only — save changes first.</p>
      <div aria-live="polite">
        {msg ? <p className="text-sm text-[var(--adm-success)]" data-testid="notification-msg">{msg}</p> : null}
        {err ? <p className="text-sm text-[var(--adm-danger)]" data-testid="notification-error">{err}</p> : null}
      </div>
    </form>
  );
}
