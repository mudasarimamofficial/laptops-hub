"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import type { SocialProofSettings } from "@/lib/content/social-proof";

const input = "mt-1 w-full min-w-0 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2";
const box = "space-y-3 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]";

/** Social-proof settings. Every switch defaults to off; there is no demo or test-data mode by design. */
export function SocialProofForm({ initial }: { initial: SocialProofSettings }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<SocialProofSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const setA = <K extends keyof SocialProofSettings["activity"]>(k: K, val: SocialProofSettings["activity"][K]) => setV((x) => ({ ...x, activity: { ...x.activity, [k]: val } }));
  const setT = <K extends keyof SocialProofSettings["topSeller"]>(k: K, val: SocialProofSettings["topSeller"][K]) => setV((x) => ({ ...x, topSeller: { ...x.topSeller, [k]: val } }));
  const setR = <K extends keyof SocialProofSettings["reels"]>(k: K, val: SocialProofSettings["reels"][K]) => setV((x) => ({ ...x, reels: { ...x.reels, [k]: val } }));
  const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
  const fieldErr = (k: string) => (fe[k] ? <span role="alert" className="mt-1 block text-xs text-[var(--adm-danger,#b42318)]">{fe[k]}</span> : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    setFe({});
    try {
      const res = await fetch("/api/admin/social-proof", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFe(data.fieldErrors || {});
        setErr(data.message || `Save failed (${res.status})`);
        return;
      }
      setMsg("Saved. The storefront updates within a minute.");
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} data-testid="social-proof-form" className="space-y-5 text-sm">
      <fieldset className={box}>
        <legend className="px-1 text-base font-semibold">Recent order notices</legend>
        <p className="text-[var(--adm-ink-2)]">
          A small corner notice such as “A customer ordered HP EliteBook 840 G8 today”. It is built only from real orders you have confirmed —
          never names, phone numbers, addresses or order numbers — and shows nothing while there are no such orders.
        </p>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={v.activity.enabled} onChange={(e) => setA("enabled", e.target.checked)} data-testid="activity-enabled" />
          <span>Show recent order notices on the storefront</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            Count orders that are
            <select className={input} value={v.activity.minStatus} onChange={(e) => setA("minStatus", e.target.value as "confirmed" | "delivered")}>
              <option value="confirmed">Confirmed by staff (or later)</option>
              <option value="delivered">Delivered</option>
            </select>
          </label>
          <label className="block">
            Only orders from the last (days)
            <input className={input} type="number" min={1} max={90} value={Number.isNaN(v.activity.windowDays) ? "" : v.activity.windowDays} onChange={(e) => setA("windowDays", num(e.target.value))} />
            {fieldErr("activity.windowDays")}
          </label>
          <label className="block">
            Seconds between notices
            <input className={input} type="number" min={10} max={600} value={Number.isNaN(v.activity.intervalSeconds) ? "" : v.activity.intervalSeconds} onChange={(e) => setA("intervalSeconds", num(e.target.value))} />
            {fieldErr("activity.intervalSeconds")}
          </label>
          <label className="block">
            Seconds each notice stays
            <input className={input} type="number" min={3} max={20} value={Number.isNaN(v.activity.displaySeconds) ? "" : v.activity.displaySeconds} onChange={(e) => setA("displaySeconds", num(e.target.value))} />
            {fieldErr("activity.displaySeconds")}
          </label>
          <label className="block">
            At most this many per visit
            <input className={input} type="number" min={1} max={10} value={Number.isNaN(v.activity.maxPerSession) ? "" : v.activity.maxPerSession} onChange={(e) => setA("maxPerSession", num(e.target.value))} />
            {fieldErr("activity.maxPerSession")}
          </label>
          <label className="block">
            Position
            <select className={input} value={v.activity.position} onChange={(e) => setA("position", e.target.value as "bottom-left" | "bottom-right")}>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </select>
          </label>
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={v.activity.showCity} onChange={(e) => setA("showCity", e.target.checked)} />
          <span>Mention the delivery city (“A customer in Lahore …”). Leave off unless your privacy policy covers it.</span>
        </label>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-base font-semibold">“Top seller” badge (from real orders)</legend>
        <p className="text-[var(--adm-ink-2)]">
          Calculated automatically from confirmed order quantities. It cannot be given to a product by hand, and with no qualifying orders no
          product gets it. Cancelled, failed and returned orders never count.
        </p>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={v.topSeller.enabled} onChange={(e) => setT("enabled", e.target.checked)} data-testid="top-seller-enabled" />
          <span>Show the “Top seller” badge</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            Count orders that are
            <select className={input} value={v.topSeller.minStatus} onChange={(e) => setT("minStatus", e.target.value as "confirmed" | "delivered")}>
              <option value="confirmed">Confirmed by staff (or later)</option>
              <option value="delivered">Delivered</option>
            </select>
          </label>
          <label className="block">
            Over the last (days)
            <input className={input} type="number" min={7} max={365} value={Number.isNaN(v.topSeller.windowDays) ? "" : v.topSeller.windowDays} onChange={(e) => setT("windowDays", num(e.target.value))} />
            {fieldErr("topSeller.windowDays")}
          </label>
          <label className="block">
            Minimum units ordered
            <input className={input} type="number" min={2} max={1000} value={Number.isNaN(v.topSeller.minUnits) ? "" : v.topSeller.minUnits} onChange={(e) => setT("minUnits", num(e.target.value))} />
            {fieldErr("topSeller.minUnits")}
          </label>
          <label className="block">
            Badge at most this many products
            <input className={input} type="number" min={1} max={24} value={Number.isNaN(v.topSeller.maxProducts) ? "" : v.topSeller.maxProducts} onChange={(e) => setT("maxProducts", num(e.target.value))} />
            {fieldErr("topSeller.maxProducts")}
          </label>
        </div>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-base font-semibold">Editorial labels</legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={v.editorial.enabled} onChange={(e) => setV((x) => ({ ...x, editorial: { enabled: e.target.checked } }))} />
          <span>Show the labels you pick below (“Featured”, “Popular pick”, “Staff pick”). Turning this off hides them all without deleting them.</span>
        </label>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-base font-semibold">Reels row</legend>
        <label className="block">
          Heading
          <input className={input} value={v.reels.heading} maxLength={80} onChange={(e) => setR("heading", e.target.value)} />
          {fieldErr("reels.heading")}
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={v.reels.autoplayMuted} onChange={(e) => setR("autoplayMuted", e.target.checked)} />
          <span>
            Play the visible reel automatically, without sound (one at a time). Shoppers who prefer reduced motion or save data always get a
            play button instead, and some browsers block autoplay.
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!hydrated || busy || !dirty} className="rounded-full bg-[var(--adm-accent,#2159D4)] px-5 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        {dirty && !busy ? <span className="text-[var(--adm-ink-2)]">Unsaved changes</span> : null}
        {err ? <p role="alert" className="text-[var(--adm-danger,#b42318)]">{err}</p> : null}
        {msg ? <p role="status" className="text-emerald-700">{msg}</p> : null}
      </div>
    </form>
  );
}
