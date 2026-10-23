"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  productTitle: string;
  productHandle: string;
};

type Status = "idle" | "sending" | "sent" | "error" | "limited";

const PHONE_RE = /^\+?[0-9][0-9\s-]{9,14}$/;

/**
 * V5 "Ask about this product" dialog. Submits to the existing rate-limited /api/contact
 * route (stored in contact_inquiries, visible in /admin/inquiries). No contact details shown.
 */
export function InquiryDialog({ open, onClose, productTitle, productHandle }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [status, setStatus] = useState<Status>("idle");
  const boxRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  // Keyed on `open` only: parent re-renders (e.g. card hover) must not re-run focus/scroll-lock.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && boxRef.current) {
        const els = boxRef.current.querySelectorAll<HTMLElement>("button, input, textarea, [href]");
        if (!els.length) return;
        const firstEl = els[0];
        const lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  async function submit() {
    const err: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) err.name = "Enter your name";
    if (!PHONE_RE.test(phone.trim())) err.phone = "Enter a valid phone number";
    setErrors(err);
    if (Object.keys(err).length) return;
    setStatus("sending");
    const message = [`Availability inquiry: ${productTitle}`, `Product: /products/${productHandle}`, msg.trim()]
      .filter(Boolean)
      .join("\n\n");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          subject: `Availability: ${productTitle}`.slice(0, 160),
          message: message.slice(0, 4000),
          company,
        }),
      });
      if (res.status === 429) return setStatus("limited");
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const field =
    "mt-1.5 w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] text-[var(--lh-ink)] outline-none focus:border-[var(--lh-action)]";

  // Portal: cards use a hover transform, which would otherwise re-anchor position:fixed to the card.
  return createPortal(
    <>
      <div aria-hidden className="fixed inset-0 z-[95] bg-[rgba(10,23,48,.6)] backdrop-blur-[6px]" onClick={onClose} />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-[96] flex max-h-[calc(100vh-24px)] w-[min(500px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-auto rounded-[24px] bg-white p-6 text-[var(--lh-ink)] shadow-[0_40px_80px_-30px_rgba(10,23,48,.6)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span id={titleId} className="font-[family-name:var(--font-display)] text-[21px] font-bold">
              Ask about this product
            </span>
            <span className="text-sm text-[var(--lh-ink-2)]">{productTitle}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {status === "sent" ? (
          <>
            <div role="status" className="rounded-2xl bg-[var(--lh-success-bg)] p-4 text-sm text-[var(--lh-success)]">
              <p className="m-0 font-bold">Inquiry sent</p>
              <p className="m-0 mt-1">Your inquiry has been received.</p>
            </div>
            <button type="button" onClick={onClose} className="h-12 rounded-xl bg-[var(--lh-action)] text-sm font-bold text-white">
              Done
            </button>
          </>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="text-sm font-semibold">
              Name
              <input
                ref={firstRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={!!errors.name}
                className={`${field} ${errors.name ? "border-[var(--lh-error)]" : "border-[var(--lh-border)]"}`}
              />
              {errors.name ? <span className="mt-1 block text-xs text-[var(--lh-error)]">{errors.name}</span> : null}
            </label>
            <label className="text-sm font-semibold">
              Phone or WhatsApp number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="03XX XXXXXXX"
                aria-invalid={!!errors.phone}
                className={`${field} ${errors.phone ? "border-[var(--lh-error)]" : "border-[var(--lh-border)]"}`}
              />
              {errors.phone ? <span className="mt-1 block text-xs text-[var(--lh-error)]">{errors.phone}</span> : null}
            </label>
            <label className="text-sm font-semibold">
              Message (optional)
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
                maxLength={3000}
                className={`${field} border-[var(--lh-border)]`}
              />
            </label>
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="absolute -left-[9999px] h-px w-px opacity-0"
              name="company"
            />
            {status === "error" ? (
              <p role="alert" className="m-0 text-sm text-[var(--lh-error)]">
                Could not send your inquiry. Please try again.
              </p>
            ) : null}
            {status === "limited" ? (
              <p role="alert" className="m-0 text-sm text-[var(--lh-error)]">
                Too many requests. Try again later.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={status === "sending"}
              className="h-12 rounded-xl bg-[var(--lh-action)] text-sm font-bold text-white disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send inquiry"}
            </button>
          </form>
        )}
      </div>
    </>,
    document.body,
  );
}

/** PDP block shown instead of Add to cart when the product is not purchasable. */
export function ProductInquiry({ productTitle, productHandle }: { productTitle: string; productHandle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[54px] rounded-[14px] bg-[var(--lh-navy)] px-6 text-base font-bold text-white"
      >
        Ask about this product
      </button>
      <span className="text-[13px] text-[var(--lh-ink-2)]">Tell us what you need and we’ll reply directly.</span>
      <InquiryDialog open={open} onClose={() => setOpen(false)} productTitle={productTitle} productHandle={productHandle} />
    </div>
  );
}
