"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="lh-content flex min-h-[60vh] items-center justify-center py-12">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-8 shadow-sm">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Staff sign in</h1>
        <p className="mt-2 text-sm text-[var(--lh-ink-2)]">No public admin registration.</p>
        <label className="mt-6 block text-sm">
          Email
          <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm">
          Password
          <input name="password" type="password" required className="mt-1 w-full rounded-xl border border-[var(--lh-border)] px-3 py-2" />
        </label>
        {error ? <p className="mt-3 text-sm text-[var(--lh-error)]">{error}</p> : null}
        <button type="submit" className="lh-btn lh-btn-primary mt-6 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
