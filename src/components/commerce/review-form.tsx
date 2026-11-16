"use client";

import { useId, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Errors = Partial<Record<"name" | "rating" | "body" | "email" | "title", string>>;

/** Customer review form. Submissions go to moderation; the shopper is told exactly that. */
export function ReviewForm({ handle }: { handle: string }) {
  const id = useId();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const field = (bad?: string) =>
    ({ height: 48, padding: "0 16px", border: `1px solid ${bad ? "var(--lh-error)" : "var(--lh-border)"}`, borderRadius: 14, fontSize: 15, background: "var(--lh-canvas)", color: "var(--lh-ink)", width: "100%", minWidth: 0 }) as const;
  const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--lh-ink)" } as const;
  const errId = (k: keyof Errors) => `${id}-${k}-err`;
  const err = (k: keyof Errors) =>
    errors[k] ? (
      <span id={errId(k)} role="alert" style={{ marginTop: -8, fontSize: 12, fontWeight: 600, color: "var(--lh-error)" }}>
        {errors[k]}
      </span>
    ) : null;
  const a11y = (k: keyof Errors) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? errId(k) : undefined });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const local: Errors = {};
    if (name.trim().length < 2) local.name = "Enter your name.";
    if (rating < 1) local.rating = "Choose a rating from 1 to 5.";
    if (body.trim().length < 10) local.body = "Write at least 10 characters.";
    setErrors(local);
    if (Object.keys(local).length) return;
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, name, rating, title, body, email, company }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(json.fieldErrors || {});
        setMessage(json.message || "Could not send your review. Try again.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setMessage("Network error — try again.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" data-testid="review-sent" style={{ margin: 0, padding: 20, borderRadius: 20, background: "var(--lh-ice)", fontSize: 15 }}>
        Thank you. Your review was received and will appear here after our team checks it.
      </p>
    );
  }
  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="v5-hov-bd-action"
          style={{ minHeight: 48, padding: "0 22px", borderRadius: 999, border: "1px solid var(--lh-border)", background: "#FFFFFF", fontWeight: 700, fontSize: 15, color: "var(--lh-ink)", cursor: "pointer" }}
        >
          Write a review
        </button>
      </div>
    );
  }
  return (
    <form method="post" onSubmit={onSubmit} noValidate aria-labelledby={`${id}-h`} style={{ display: "grid", gap: 14, padding: 22, borderRadius: 20, border: "1px solid var(--lh-border)", background: "#FFFFFF", maxWidth: 720 }}>
      <h3 id={`${id}-h`} style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20 }}>
        Write a review
      </h3>
      <p style={{ margin: 0, fontSize: 14, color: "var(--lh-ink-2)" }}>Reviews are checked by our team before they appear. Please describe your own experience with this laptop.</p>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Rating</legend>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, borderRadius: 12, border: `1px solid ${rating === n ? "var(--lh-action)" : "var(--lh-border)"}`, background: rating === n ? "var(--lh-ice)" : "#FFFFFF", cursor: "pointer", fontWeight: 700 }}>
              <input type="radio" name={`${id}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} aria-label={`${n} out of 5`} />
              {n}★
            </label>
          ))}
        </div>
        {err("rating")}
      </fieldset>
      <label style={label}>
        Your name
        <input style={field(errors.name)} {...a11y("name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
      </label>
      {err("name")}
      <label style={label}>
        Headline <span style={{ fontWeight: 400, color: "var(--lh-ink-2)" }}>(optional)</span>
        <input style={field(errors.title)} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </label>
      <label style={label}>
        Your review
        <textarea style={{ ...field(errors.body), height: 140, padding: 14, resize: "vertical" }} {...a11y("body")} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      </label>
      {err("body")}
      <label style={label}>
        Email <span style={{ fontWeight: 400, color: "var(--lh-ink-2)" }}>(optional, never shown — only used if we need to contact you)</span>
        <input style={field(errors.email)} {...a11y("email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
      </label>
      {err("email")}
      <label aria-hidden="true" style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
        Company
        <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </label>
      {message ? (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: "var(--lh-error)" }}>
          {message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={!hydrated || state === "sending"}
          style={{ minHeight: 48, padding: "0 26px", borderRadius: 999, border: 0, background: "var(--lh-action)", color: "#FFFFFF", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: !hydrated || state === "sending" ? 0.6 : 1 }}
        >
          {state === "sending" ? "Sending…" : "Submit review"}
        </button>
      </div>
    </form>
  );
}
