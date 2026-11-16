"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { StaffRole } from "@/lib/auth/staff";
import { staffChangeProblem } from "@/lib/auth/staff-admin";

export type Row = {
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

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(new Date(iso)) : "—";

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export function StaffInviteForm({
  grantable,
  onInviteSuccess,
}: {
  grantable: string[];
  onInviteSuccess?: (invited: { userId: string; email: string; role: string }) => void;
}) {
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
      if (!r.ok) {
        setMsg({ kind: "error", text: r.json.message || `Failed (${r.status})` });
      } else {
        const text = r.json.emailSent ? `Invitation sent to ${email}.` : r.json.message;
        setMsg({ kind: r.json.emailSent ? "ok" : "error", text });
        if (onInviteSuccess && r.json.userId) {
          onInviteSuccess({ userId: r.json.userId, email, role });
        }
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

export function StaffRowActions({
  row,
  grantable,
  editable,
  onRowChange,
}: {
  row: Row;
  grantable: string[];
  editable: boolean;
  onRowChange?: (updated: Partial<Row>) => void;
}) {
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
      if (r.ok) {
        if (onRowChange) {
          if (body.action === "deactivate") onRowChange({ active: false });
          else if (body.action === "activate") onRowChange({ active: true });
          else if (body.action === "role" && typeof body.role === "string") onRowChange({ role: body.role });
        }
        router.refresh();
      }
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

export function StaffDirectory({
  initialRows,
  grantable,
  currentUserId,
  currentUserRole,
  canEmail,
}: {
  initialRows: Row[];
  grantable: string[];
  currentUserId: string;
  currentUserRole: StaffRole;
  canEmail: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);

  const syncList = async () => {
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.staff)) {
          setRows(data.staff);
        }
      }
    } catch {}
  };

  const handleInviteSuccess = (invited: { userId: string; email: string; role: string }) => {
    setRows((prev) => {
      const without = prev.filter((r) => r.userId !== invited.userId);
      return [
        ...without,
        {
          userId: invited.userId,
          email: invited.email,
          role: invited.role,
          active: true,
          lastSignInAt: null,
          invitePending: true,
        },
      ];
    });
    syncList();
  };

  const handleRowChange = (userId: string, update: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, ...update } : r))
    );
    syncList();
  };

  return (
    <>
      <h2 className="mt-8 text-lg font-semibold">Invite someone</h2>
      {canEmail ? (
        <StaffInviteForm grantable={grantable} onInviteSuccess={handleInviteSuccess} />
      ) : (
        <p role="status" className="mt-3 rounded-2xl border border-[var(--lh-border)] bg-white p-4 text-sm">
          Invitations need email sending to be set up (Resend API key and a verified sender). Until then no invitation can be delivered.
        </p>
      )}

      <h2 className="mt-10 text-lg font-semibold">People with access ({rows.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--lh-border)] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--lh-ice)] text-xs uppercase tracking-wide text-[var(--lh-ink-2)]">
            <tr>
              <th scope="col" className="px-4 py-2">Person</th>
              <th scope="col" className="px-4 py-2">Status</th>
              <th scope="col" className="px-4 py-2">Last sign-in</th>
              <th scope="col" className="px-4 py-2">Role / actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editable =
                staffChangeProblem({
                  actorId: currentUserId,
                  actorRole: currentUserRole,
                  targetId: r.userId,
                  targetRole: r.role as StaffRole,
                }) === null;
              return (
                <tr key={r.userId} data-testid="staff-row" data-email={r.email ?? ""} className="border-t border-[var(--lh-border)] align-top">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{r.email ?? "Unknown account"}</span>
                    {r.userId === currentUserId ? <span className="ml-2 text-xs text-[var(--lh-ink-2)]">(you)</span> : null}
                  </td>
                  <td className="px-4 py-3">{!r.active ? "Deactivated" : r.invitePending ? "Invited — not signed in yet" : "Active"}</td>
                  <td className="px-4 py-3">{fmt(r.lastSignInAt)}</td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <StaffRowActions
                        row={r}
                        grantable={grantable}
                        editable
                        onRowChange={(update) => handleRowChange(r.userId, update)}
                      />
                    ) : (
                      <span className="capitalize">{r.role}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
