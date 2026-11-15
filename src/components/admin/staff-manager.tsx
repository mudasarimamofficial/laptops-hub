"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Row = {
  userId: string;
  email: string | null;
  role: string;
  active: boolean;
  lastSignInAt: string | null;
  invitePending: boolean;
};

const ROLE_HELP: Record<string, string> = {
  admin: "Everything except changing the owner",
  manager: "Products, orders, settings, content",
  editor: "Content, blog, reviews, reels, theme drafts",
  fulfillment: "Orders: confirm, pack, dispatch, collect cash",
};

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export function StaffInviteForm({ grantable }: { grantable: string[] }) {
  const router = useRouter();
  const ids = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(grantable[grantable.length - 1] ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await call("/api/admin/staff", "POST", { email, role });
      if (!r.ok) setMsg({ kind: "error", text: r.json.message || `Failed (${r.status})` });
      else {
        setMsg({ kind: r.json.emailSent ? "ok" : "error", text: r.json.emailSent ? `Invitation sent to ${email}.` : r.json.message });
        setEmail("");
        router.refresh();
      }
    } catch {
      setMsg({ kind: "error", text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} method="post" className="mt-4 grid gap-3 rounded-2xl border border-[var(--lh-border)] bg-white p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
      <div className="grid gap-1 text-sm">
        <label htmlFor={`${ids}-email`} className="font-semibold">Email address</label>
        <input id={`${ids}-email`} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-[var(--lh-border)] px-3 py-2" />
      </div>
      <div className="grid gap-1 text-sm">
        <label htmlFor={`${ids}-role`} className="font-semibold">Role</label>
        <select id={`${ids}-role`} value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl border border-[var(--lh-border)] px-3 py-2">
          {grantable.map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={busy || !email} className="lh-btn lh-btn-primary h-10">
        {busy ? "Sending…" : "Send invitation"}
      </button>
      <p className="text-xs text-[var(--lh-ink-2)] sm:col-span-3">{ROLE_HELP[role]}</p>
      {msg ? (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`text-sm sm:col-span-3 ${msg.kind === "error" ? "text-[var(--lh-error)]" : "text-[var(--lh-success,#1F7A4D)]"}`}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}

export function StaffRowActions({ row, grantable, editable }: { row: Row; grantable: string[]; editable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!editable) return null;

  async function act(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await call(`/api/admin/staff/${row.userId}`, "PATCH", body);
      setMsg(r.ok ? (body.action === "resend" ? "Sent." : null) : r.json.message || `Failed (${r.status})`);
      if (r.ok) router.refresh();
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        aria-label={`Role for ${row.email ?? "member"}`}
        value={row.role}
        disabled={busy || !row.active}
        onChange={(e) => act({ action: "role", role: e.target.value })}
        className="rounded-xl border border-[var(--lh-border)] px-2 py-1"
      >
        {!grantable.includes(row.role) ? <option value={row.role}>{row.role}</option> : null}
        {grantable.map((r) => (
          <option key={r} value={r}>
            {r[0].toUpperCase() + r.slice(1)}
          </option>
        ))}
      </select>
      {row.active ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: "deactivate" }, `Remove admin access for ${row.email}? They are signed out everywhere and cannot sign in until reactivated.`)}
          className="rounded-full border border-[var(--lh-border)] bg-white px-3 py-1"
        >
          Deactivate
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => act({ action: "activate" })} className="rounded-full border border-[var(--lh-border)] bg-white px-3 py-1">
          Reactivate
        </button>
      )}
      {row.active && row.invitePending ? (
        <button type="button" disabled={busy} onClick={() => act({ action: "resend" })} className="rounded-full border border-[var(--lh-border)] bg-white px-3 py-1">
          Resend invitation
        </button>
      ) : null}
      {msg ? <span role="status" className="text-[var(--lh-ink-2)]">{msg}</span> : null}
    </div>
  );
}
