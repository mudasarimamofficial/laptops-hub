"use client";

import { useEffect, useRef, useState } from "react";

/** V5 FAQ accordion (`isFaq`): one card, rows toggle independently, SOON tag on unanswered questions. */
export function FaqList({ items }: { items: { q: string; a: string; pend: boolean }[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 18, background: "#FFFFFF", border: "1px solid var(--lh-border)", overflow: "hidden", maxWidth: 820 }}>
      {items.map((qa, i) => {
        const isOpen = !!open[i];
        const id = `faq-${i}-${qa.q.length}`;
        return (
          <div key={i} style={{ borderBottom: "1px solid var(--lh-divider)" }}>
            <button
              type="button"
              className="v5-hov-canvas"
              onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
              aria-expanded={isOpen}
              aria-controls={id}
              style={{ width: "100%", minHeight: 56, padding: "14px 18px", border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, textAlign: "left", fontSize: 16, fontWeight: 600, color: "var(--lh-ink)", cursor: "pointer" }}
            >
              <span>{qa.q}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {qa.pend ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 999, background: "var(--lh-warning-bg)", color: "var(--lh-warning)" }}>SOON</span>
                ) : null}
                <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 400, color: "var(--lh-action)", width: 16, textAlign: "center" }}>
                  {isOpen ? "−" : "+"}
                </span>
              </span>
            </button>
            {isOpen ? (
              <div id={id} style={{ padding: "0 18px 18px", fontSize: 15, lineHeight: 1.65, color: "var(--lh-ink-2)", maxWidth: "68ch" }}>
                {qa.a}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** V5 "On this page" (`pg.toc`): smooth-scroll to section headings, 96px offset. */
export function TocButtons({ items }: { items: { id: string; label: string }[] }) {
  return (
    <>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          className="v5-hov-toc"
          onClick={() => {
            const el = document.getElementById(t.id);
            if (!el) return;
            const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 96, behavior: rm ? "auto" : "smooth" });
          }}
          style={{ textAlign: "left", padding: "8px 12px", border: 0, borderLeft: "2px solid var(--lh-border)", background: "transparent", fontSize: 14, color: "var(--lh-ink-2)", cursor: "pointer" }}
        >
          {t.label}
        </button>
      ))}
    </>
  );
}

const SUBJECTS = ["Product question", "Availability of a model", "Chromebooks", "Existing order", "Other"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{9,14}$/;
type Fields = { name: string; email: string; phone: string; subject: string; msg: string };
type Errors = Partial<Record<"name" | "email" | "phone" | "msg", string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const EMPTY: Fields = { name: "", email: "", phone: "", subject: SUBJECTS[0], msg: "" };

/**
 * V5 contact form (`isForm`), connected to the real `/api/contact` (rate limited, stored in contact_inquiries,
 * visible to staff in /admin/inquiries). Success is shown only after the server confirms the insert.
 */
export function ContactForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [e, setE] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [company, setCompany] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);
  // The form collapses into the confirmation; bring it into view and announce it.
  useEffect(() => {
    if (status.kind !== "sent" || !doneRef.current) return;
    const el = doneRef.current;
    el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    // Only move the page when the confirmation is not fully visible below the sticky header.
    if (r.top < 84 || r.bottom > innerHeight) el.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [status.kind]);
  const set = (k: keyof Fields) => (ev: { target: { value: string } }) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const bd = (k: keyof Errors) => (e[k] ? "var(--lh-error)" : "var(--lh-border)");
  const input = (k: keyof Errors) =>
    ({ height: 48, padding: "0 16px", border: `1px solid ${bd(k)}`, borderRadius: 14, fontSize: 15, fontWeight: 400, background: "var(--lh-canvas)", color: "var(--lh-ink)" }) as const;
  const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 } as const;
  const err = { minHeight: 16, fontSize: 12, fontWeight: 600, color: "var(--lh-error)" } as const;

  async function submit() {
    // Same rules as V5 `submitContact`.
    const x: Errors = {};
    if (!f.name.trim()) x.name = "Enter your name";
    if (!EMAIL_RE.test(f.email.trim())) x.email = "Enter a valid email address";
    if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) x.phone = "Enter a valid phone number or leave it blank";
    if (f.msg.trim().length < 10) x.msg = "Write at least 10 characters";
    setE(x);
    if (Object.keys(x).length) return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined, subject: f.subject, message: f.msg.trim(), company }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) {
        setStatus({ kind: "sent" });
        setF(EMPTY);
        return;
      }
      setStatus({
        kind: "error",
        message:
          j.error === "rate_limited"
            ? "Too many messages from this connection. Please try again later."
            : j.error === "validation_failed"
              ? "Some details were not accepted. Check the fields and try again."
              : "Your message could not be saved. Please try again.",
      });
    } catch {
      setStatus({ kind: "error", message: "Your message could not be sent. Check your connection and try again." });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "clamp(20px,3vw,32px)", borderRadius: 24, background: "#FFFFFF", border: "1px solid var(--lh-border)", boxShadow: "0 24px 50px -36px rgba(var(--lh-navy-rgb),.5)", maxWidth: 760 }}>
      {status.kind !== "sent" ? (
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 14 }}>
            <label style={label}>
              Name
              <input value={f.name} onChange={set("name")} autoComplete="name" aria-invalid={!!e.name} required style={input("name")} />
              <span aria-live="polite" style={err}>
                {e.name}
              </span>
            </label>
            <label style={label}>
              Email
              <input value={f.email} onChange={set("email")} type="email" autoComplete="email" aria-invalid={!!e.email} required style={input("email")} />
              <span aria-live="polite" style={err}>
                {e.email}
              </span>
            </label>
            <label style={label}>
              Phone or WhatsApp (optional)
              <input value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" aria-invalid={!!e.phone} style={input("phone")} />
              <span aria-live="polite" style={err}>
                {e.phone}
              </span>
            </label>
            <label style={label}>
              Subject
              <select value={f.subject} onChange={set("subject")} style={{ height: 48, padding: "0 14px", border: "1px solid var(--lh-border)", borderRadius: 14, fontSize: 15, fontWeight: 400, background: "var(--lh-canvas)", color: "var(--lh-ink)" }}>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label style={label}>
            Message
            <textarea value={f.msg} onChange={set("msg")} rows={5} aria-invalid={!!e.msg} required style={{ padding: "12px 16px", border: `1px solid ${bd("msg")}`, borderRadius: 14, fontSize: 15, fontWeight: 400, resize: "vertical", background: "var(--lh-canvas)", color: "var(--lh-ink)" }} />
            <span aria-live="polite" style={err}>
              {e.msg}
            </span>
          </label>
          {/* Honeypot: hidden from people and assistive tech; bots that fill it are dropped server-side. */}
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={company} onChange={(ev) => setCompany(ev.target.value)} name="company" style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }} />
          {status.kind === "error" ? (
            <div role="alert" style={{ padding: "12px 16px", borderRadius: 14, background: "#FDECEA", border: "1px solid #F5C2BC", color: "var(--lh-error)", fontSize: 14, fontWeight: 600 }}>
              {status.message}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={status.kind === "sending"}
              aria-busy={status.kind === "sending"}
              className="v5-hov-bg-action"
              style={{ height: 52, padding: "0 28px", border: 0, borderRadius: 999, background: "var(--lh-action)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: status.kind === "sending" ? "wait" : "pointer", opacity: status.kind === "sending" ? 0.7 : 1 }}
            >
              {status.kind === "sending" ? "Sending…" : "Send message"}
            </button>
            <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>Messages are stored securely for the Laptops HUB team.</span>
          </div>
        </form>
      ) : (
        <>
          <div ref={doneRef} tabIndex={-1} role="status" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 18, borderRadius: 16, background: "var(--lh-ice)", outline: "none" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>Message received</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--lh-ink)" }}>Your message was saved for the Laptops HUB team. No confirmation email is sent.</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus({ kind: "idle" })}
            style={{ alignSelf: "flex-start", height: 46, padding: "0 20px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "var(--lh-ink)" }}
          >
            Write another message
          </button>
        </>
      )}
    </div>
  );
}
