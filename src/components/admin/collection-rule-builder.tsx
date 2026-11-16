"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import type { CollectionRule, RuleCondition } from "@/lib/collections/rule-eval";

const FIELDS: { value: string; label: string }[] = [
  { value: "manufacturer", label: "Brand / manufacturer" },
  { value: "product_type", label: "Product type" },
  { value: "category", label: "Category" },
  { value: "title", label: "Title" },
  { value: "tags", label: "Tags" },
  { value: "price_pkr", label: "Price (PKR)" },
  { value: "featured", label: "Featured" },
  { value: "available", label: "Available" },
  { value: "specs.ram_gb", label: "RAM (GB)" },
  { value: "specs.Display", label: "Display spec" },
];

const OPS: { value: RuleCondition["op"]; label: string }[] = [
  { value: "eq", label: "is equal to" },
  { value: "neq", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "in", label: "is one of (comma list)" },
  { value: "exists", label: "exists" },
];

type Props = {
  slug: string;
  initialRule: CollectionRule | null;
};

function emptyCondition(): RuleCondition {
  return { field: "manufacturer", op: "eq", value: "" };
}

export function CollectionRuleBuilder({ slug, initialRule }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [match, setMatch] = useState<"all" | "any">(initialRule?.match === "any" ? "any" : "all");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initialRule?.conditions?.length ? initialRule.conditions : [emptyCondition()],
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function patch(i: number, patch: Partial<RuleCondition>) {
    setConditions((list) => list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const rule: CollectionRule = {
        match,
        conditions: conditions
          .filter((c) => c.field && c.op)
          .map((c) => ({
            field: c.field,
            op: c.op,
            ...(c.op === "exists" ? {} : { value: c.value }),
          })),
      };
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg("Rules saved. Storefront membership updates on next catalog resolve.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function clearRules() {
    if (!window.confirm("Clear automated rules? Collection will become manual membership.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/collections/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: {} }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || "Clear failed");
        return;
      }
      setConditions([emptyCondition()]);
      setMsg("Rules cleared.");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Automated rules</h2>
      <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
        Products matching these conditions appear in this collection on the storefront. No JSON editing required.
      </p>

      <label className="mt-4 block text-sm font-medium">
        Products must match
        <select
          className="ml-2 rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
          value={match}
          onChange={(e) => setMatch(e.target.value as "all" | "any")}
        >
          <option value="all">all conditions (AND)</option>
          <option value="any">any condition (OR)</option>
        </select>
      </label>

      <ul className="mt-4 space-y-3">
        {conditions.map((c, i) => (
          <li key={i} className="grid gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <select
              className="rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
              value={c.field}
              onChange={(e) => patch(i, { field: e.target.value })}
            >
              {FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
              value={c.op}
              onChange={(e) => patch(i, { op: e.target.value as RuleCondition["op"] })}
            >
              {OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {c.op === "exists" ? (
              <span className="self-center text-xs text-[var(--adm-ink-2)]">No value needed</span>
            ) : (
              <input
                className="rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
                value={String(c.value ?? "")}
                onChange={(e) => patch(i, { value: e.target.value })}
                placeholder="Value"
              />
            )}
            <button
              type="button"
              className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold text-[var(--adm-danger)]"
              onClick={() => setConditions((list) => list.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-sm font-semibold"
          onClick={() => setConditions((list) => [...list, emptyCondition()])}
        >
          Add condition
        </button>
        <button
          type="button"
          disabled={!hydrated || busy}
          onClick={save}
          className="rounded-lg bg-[var(--lh-action)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save rules"}
        </button>
        <button
          type="button"
          disabled={!hydrated || busy}
          onClick={clearRules}
          className="rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          Clear rules
        </button>
      </div>
      {msg ? <p className="mt-2 text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="mt-2 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
