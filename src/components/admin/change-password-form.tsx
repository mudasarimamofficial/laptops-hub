"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

/** Logged-in staff password change (current password required). */
export function ChangePasswordForm({ email }: { email: string }) {
  const hydrated = useHydrated();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: fd.get("currentPassword"),
          password: fd.get("password"),
          confirm: fd.get("confirm"),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || `Failed (${res.status})`);
        return;
      }
      setMessage(json.message || "Password updated.");
      e.currentTarget.reset();
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="max-w-md space-y-4" data-testid="change-password-form">
      <p className="text-sm text-[var(--adm-ink-2)]">
        Signed in as <span className="font-medium text-[var(--adm-ink)]">{email}</span>. Enter your current password, then
        choose a new one (at least 12 characters).
      </p>
      <label className="block text-sm">
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-[var(--adm-border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        New password
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-[var(--adm-border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Repeat new password
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-[var(--adm-border)] px-3 py-2"
        />
      </label>
      {message ? (
        <p role="status" className="text-sm text-[var(--adm-success)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--adm-danger)]">
          {error}
        </p>
      ) : null}
      <button type="submit" className="lh-btn lh-btn-primary" disabled={pending || !hydrated}>
        {pending ? "Saving…" : "Update password"}
      </button>
      <p className="text-xs text-[var(--adm-ink-2)]">
        Forgot your current password? Use{" "}
        <Link href="/admin/forgot-password" className="font-semibold text-[var(--adm-action)] underline">
          password recovery
        </Link>
        .
      </p>
    </form>
  );
}
