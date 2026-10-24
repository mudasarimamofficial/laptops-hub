"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { normalizePakistanMobile } from "@/lib/phone";
import { INQUIRY_BUDGETS, INQUIRY_TOPICS } from "@/lib/validation/contact";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Phone = { display: string; href: string };
type Fields = { name: string; phone: string; email: string; preferred: "" | "call" | "email"; topic: string; budget: string; useCase: string; msg: string };
type Errors = Partial<Record<"name" | "phone" | "email" | "contact" | "preferred" | "msg", string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const EMPTY: Fields = { name: "", phone: "", email: "", preferred: "", topic: INQUIRY_TOPICS[0], budget: "", useCase: "", msg: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Homepage "Ask Laptops HUB" inquiry (Bible ch. 05). Posts to the real `/api/contact` (`source: "home"`): rate
 * limited, origin-checked, stored in contact_inquiries and listed for staff in /admin/inquiries. Success is shown only
 * after the server confirms the insert; no email is sent and no reply time is promised.
 */
export function HomeInquirySection({ phones, privacyHref }: { phones: Phone[]; privacyHref: string | null }) {
  const id = useId();
  const hydrated = useHydrated();
  const [f, setF] = useState<Fields>(EMPTY);
  const [e, setE] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [company, setCompany] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status.kind === "sent") doneRef.current?.focus();
  }, [status.kind]);

  const set = (k: keyof Fields) => (ev: { target: { value: string } }) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const bd = (bad?: string) => (bad ? "var(--lh-error)" : "var(--lh-border)");
  const field = (bad?: string) =>
    ({ height: 48, padding: "0 16px", border: `1px solid ${bd(bad)}`, borderRadius: 14, fontSize: 15, background: "var(--lh-canvas)", color: "var(--lh-ink)", width: "100%" }) as const;
  const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--lh-ink)" } as const;
  const err = { minHeight: 16, fontSize: 12, fontWeight: 600, color: "var(--lh-error)" } as const;
  const opt = { fontWeight: 400, color: "var(--lh-ink-2)" } as const;

  async function submit() {
    const x: Errors = {};
    const phone = f.phone.trim();
    const email = f.email.trim();
    if (f.name.trim().length < 2) x.name = "Enter your name";
    if (phone && !normalizePakistanMobile(phone).ok) x.phone = "Enter a Pakistan mobile number (03XX XXXXXXX)";
    if (email && !EMAIL_RE.test(email)) x.email = "Enter a valid email address";
    if (!phone && !email) x.contact = "Give a mobile number or an email so our team can reply";
    if (f.preferred === "call" && !phone) x.preferred = "Add a mobile number to be called";
    if (f.preferred === "email" && !email) x.preferred = "Add an email address to be emailed";
    if (f.msg.trim().length < 10) x.msg = "Write at least 10 characters";
    setE(x);
    if (Object.keys(x).length) return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "home",
          name: f.name.trim(),
          phone: phone || undefined,
          email: email || undefined,
          preferred: f.preferred || undefined,
          topic: f.topic,
          budget: f.budget || undefined,
          useCase: f.useCase.trim() || undefined,
          message: f.msg.trim(),
          company,
        }),
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
              : "Your inquiry could not be saved. Please try again.",
      });
    } catch {
      setStatus({ kind: "error", message: "Your inquiry could not be sent. Check your connection and try again." });
    }
  }

  return (
    <section
      id="ask"
      aria-labelledby={`${id}-h`}
      data-screen-label="11 Inquiry"
      style={{ maxWidth: 1360, margin: "0 auto", padding: "0 clamp(16px,3vw,32px) clamp(64px,8vw,112px)" }}
    >
      <div
        className="v5-promo-grid"
        style={{
          borderRadius: 32,
          background: "radial-gradient(60% 90% at 100% 0%,rgba(var(--lh-action-rgb),.10),transparent 70%),linear-gradient(180deg,#FFFFFF,var(--lh-ice))",
          border: "1px solid var(--lh-border)",
          padding: "clamp(24px,4vw,56px)",
          display: "grid",
          gap: "clamp(28px,4vw,56px)",
          alignItems: "start",
          color: "var(--lh-ink)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--lh-ink-2)" }}>
            <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
            11 — NEED HELP CHOOSING?
          </span>
          <h2 id={`${id}-h`} style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(30px,3.2vw,48px)", letterSpacing: "-.04em", lineHeight: 1.04, fontWeight: 700 }}>
            Tell us what you&apos;re looking for.
          </h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "var(--lh-ink-2)", maxWidth: "46ch" }}>
            Looking for a laptop for work, studies, gaming or everyday use? Share your requirements or ask about a model. Our team can review your
            message and contact you using the details you provide.
          </p>
          {phones.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Or call Laptops HUB</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {phones.map((p) => (
                  <a key={p.href} href={p.href} className="v5-hov-bd-action" style={{ height: 44, padding: "0 18px", borderRadius: 999, background: "#FFFFFF", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", fontFamily: "var(--font-mono)" }}>
                    {p.display}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--lh-ink-2)", maxWidth: "52ch" }}>
            We use these details only to reply to this inquiry — no newsletters or marketing.
            {privacyHref ? (
              <>
                {" "}
                See our{" "}
                <Link href={privacyHref} style={{ color: "var(--lh-action)", textDecoration: "underline" }}>
                  privacy policy
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>

        <div style={{ borderRadius: 24, background: "#FFFFFF", border: "1px solid var(--lh-border)", boxShadow: "0 24px 50px -36px rgba(var(--lh-navy-rgb),.5)", padding: "clamp(20px,3vw,32px)" }}>
          {status.kind !== "sent" ? (
            <form
              noValidate
              method="post"
              aria-label="Send an inquiry to Laptops HUB"
              onSubmit={(ev) => {
                ev.preventDefault();
                void submit();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14 }}>
                <label style={label}>
                  Full name
                  <input value={f.name} onChange={set("name")} autoComplete="name" required aria-invalid={!!e.name} style={field(e.name)} />
                  <span aria-live="polite" style={err}>{e.name}</span>
                </label>
                <label style={label}>
                  <span>Topic</span>
                  <select value={f.topic} onChange={set("topic")} style={field()}>
                    {INQUIRY_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span style={err} />
                </label>
                <label style={label}>
                  <span>
                    Mobile number <span style={opt}>(or email)</span>
                  </span>
                  <input value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" aria-invalid={!!(e.phone || e.contact)} style={field(e.phone || e.contact)} />
                  <span aria-live="polite" style={err}>{e.phone}</span>
                </label>
                <label style={label}>
                  <span>
                    Email <span style={opt}>(or mobile)</span>
                  </span>
                  <input value={f.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" aria-invalid={!!(e.email || e.contact)} style={field(e.email || e.contact)} />
                  <span aria-live="polite" style={err}>{e.email}</span>
                </label>
              </div>
              {e.contact ? (
                <span role="alert" style={{ ...err, minHeight: 0, marginTop: -8 }}>
                  {e.contact}
                </span>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14 }}>
                <label style={label}>
                  <span>
                    Budget <span style={opt}>(optional)</span>
                  </span>
                  <select value={f.budget} onChange={set("budget")} style={field()}>
                    <option value="">Any budget</option>
                    {INQUIRY_BUDGETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={label}>
                  <span>
                    Main use <span style={opt}>(optional)</span>
                  </span>
                  <input value={f.useCase} onChange={set("useCase")} maxLength={120} placeholder="e.g. studies, office, coding" style={field()} />
                </label>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <legend style={{ fontSize: 13, fontWeight: 700, padding: 0, marginBottom: 6 }}>
                  How should we contact you? <span style={opt}>(optional)</span>
                </legend>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 15 }}>
                  {(
                    [
                      ["", "No preference"],
                      ["call", "Phone call"],
                      ["email", "Email"],
                    ] as const
                  ).map(([v, l]) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, cursor: "pointer" }}>
                      <input type="radio" name={`${id}-pref`} value={v} checked={f.preferred === v} onChange={() => setF((x) => ({ ...x, preferred: v }))} />
                      {l}
                    </label>
                  ))}
                </div>
                <span aria-live="polite" style={err}>{e.preferred}</span>
              </fieldset>
              <label style={label}>
                Your requirements or question
                <textarea value={f.msg} onChange={set("msg")} rows={4} maxLength={4000} required aria-invalid={!!e.msg} style={{ padding: "12px 16px", border: `1px solid ${bd(e.msg)}`, borderRadius: 14, fontSize: 15, fontWeight: 400, resize: "vertical", background: "var(--lh-canvas)", color: "var(--lh-ink)" }} />
                <span aria-live="polite" style={err}>{e.msg}</span>
              </label>
              {/* Honeypot: hidden from people and assistive tech; filled submissions are dropped server-side. */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={company} onChange={(ev) => setCompany(ev.target.value)} name="company" style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }} />
              {status.kind === "error" ? (
                <div role="alert" style={{ padding: "12px 16px", borderRadius: 14, background: "#FDECEA", border: "1px solid #F5C2BC", color: "var(--lh-error)", fontSize: 14, fontWeight: 600 }}>
                  {status.message}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={!hydrated || status.kind === "sending"}
                aria-busy={status.kind === "sending"}
                className="v5-hov-bright"
                style={{ alignSelf: "flex-start", height: 52, padding: "0 28px", border: 0, borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: status.kind === "sending" ? "wait" : "pointer", opacity: status.kind === "sending" ? 0.7 : 1 }}
              >
                {status.kind === "sending" ? "Sending…" : "Send my inquiry"}
              </button>
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div ref={doneRef} tabIndex={-1} role="status" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 18, borderRadius: 16, background: "var(--lh-ice)", outline: "none" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>Inquiry received</span>
                <span style={{ fontSize: 15, lineHeight: 1.55 }}>Your inquiry has been received. Our team can contact you using the details provided.</span>
              </div>
              <button type="button" onClick={() => setStatus({ kind: "idle" })} style={{ alignSelf: "flex-start", height: 46, padding: "0 20px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "var(--lh-ink)" }}>
                Send another inquiry
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
