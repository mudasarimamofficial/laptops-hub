"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { EDITORIAL_LABELS, type EditorialKind } from "@/lib/content/social-proof";

const input = "mt-1 w-full min-w-0 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2";

/** `datetime-local` value (local time) → ISO with offset, or "" when blank. */
function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Add or replace the editorial label of one product. */
export function ProductBadgeForm({ products }: { products: { handle: string; title: string }[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [handle, setHandle] = useState("");
  const [kind, setKind] = useState<EditorialKind>("featured");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    setFe({});
    try {
      const res = await fetch("/api/admin/product-badges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productHandle: handle.trim(), kind, startsAt: toIso(startsAt), endsAt: toIso(endsAt), note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFe(data.fieldErrors || {});
        setErr(data.message || `Save failed (${res.status})`);
        return;
      }
      setMsg("Label saved.");
      setHandle("");
      setStartsAt("");
      setEndsAt("");
      setNote("");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }
  const fieldErr = (k: string) => (fe[k] ? <span role="alert" className="mt-1 block text-xs text-[var(--adm-danger,#b42318)]">{fe[k]}</span> : null);

  return (
    <form method="post" onSubmit={onSubmit} data-testid="badge-form" className="grid gap-3 text-sm sm:grid-cols-2">
      <label className="block sm:col-span-2">
        Product
        <input className={input} list="badge-products" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Type to search, then pick the handle" required />
        <datalist id="badge-products">
          {products.map((p) => (
            <option key={p.handle} value={p.handle}>
              {p.title}
            </option>
          ))}
        </datalist>
        {fieldErr("productHandle")}
      </label>
      <label className="block">
        Label
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value as EditorialKind)}>
          {(Object.keys(EDITORIAL_LABELS) as EditorialKind[]).map((k) => (
            <option key={k} value={k}>
              {EDITORIAL_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Internal note (optional)
        <input className={input} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Why this product" />
      </label>
      <label className="block">
        Show from (optional)
        <input className={input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        {fieldErr("startsAt")}
      </label>
      <label className="block">
        Until (optional)
        <input className={input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        {fieldErr("endsAt")}
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={!hydrated || busy} className="rounded-full bg-[var(--adm-accent,#2159D4)] px-5 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save label"}
        </button>
        {err ? <p role="alert" className="text-[var(--adm-danger,#b42318)]">{err}</p> : null}
        {msg ? <p role="status" className="text-emerald-700">{msg}</p> : null}
      </div>
    </form>
  );
}

export function RemoveBadgeButton({ productId, title }: { productId: string; title: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={!hydrated || busy}
      className="rounded-full border border-[var(--adm-border)] px-3 py-1 text-xs disabled:opacity-50"
      onClick={async () => {
        if (!window.confirm(`Remove the label from ${title}?`)) return;
        setBusy(true);
        const res = await fetch("/api/admin/product-badges", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
        setBusy(false);
        if (res.ok) router.refresh();
        else window.alert(`Could not remove the label (${res.status}).`);
      }}
    >
      Remove
    </button>
  );
}
