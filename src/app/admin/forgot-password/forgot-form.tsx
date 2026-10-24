"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

export function ForgotPasswordForm({ linkInvalid }: { linkInvalid: boolean }) {
  const hydrated = useHydrated();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/account/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(new FormData(e.currentTarget).get("email")) }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setMessage(json.message);
      else setError(json.message || `Request failed (${res.status})`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="w-full max-w-md rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-8 shadow-sm">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Reset staff password</h1>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        Enter the email you sign in with. We send a link to set a new password; your role and access stay the same.
      </p>
      {linkInvalid ? (
        <p role="alert" className="mt-4 text-sm text-[var(--lh-error)]">
          That reset link is invalid or has expired. Request a new one below.
        </p>
      ) : null}
      <label className="mt-6 block text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      </label>
      {message ? (
        <p role="status" className="mt-3 text-sm text-[var(--lh-success)]">
          {message}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[var(--lh-error)]">{error}</p> : null}
      <button type="submit" className="lh-btn lh-btn-primary mt-6 w-full" disabled={pending || !hydrated}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="mt-4 text-center text-sm">
        <Link href="/admin/login" className="text-[var(--lh-action)]">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
