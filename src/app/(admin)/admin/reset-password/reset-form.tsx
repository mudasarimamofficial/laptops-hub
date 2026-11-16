"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

export function ResetPasswordForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: fd.get("password"), confirm: fd.get("confirm") }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || `Failed (${res.status})`);
        return;
      }
      router.replace("/admin/login?reset=1");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <label className="mt-6 block text-sm">
        New password
        <input name="password" type="password" required autoComplete="new-password" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      </label>
      <label className="mt-4 block text-sm">
        Repeat new password
        <input name="confirm" type="password" required autoComplete="new-password" className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      </label>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--lh-error)]">
          {error}
        </p>
      ) : null}
      <button type="submit" className="lh-btn lh-btn-primary mt-6 w-full" disabled={pending || !hydrated}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
