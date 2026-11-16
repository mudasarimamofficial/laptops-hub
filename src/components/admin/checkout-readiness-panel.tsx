import Link from "next/link";
import type { Readiness } from "@/lib/commerce/checkout-readiness";

const STATE_STYLE = {
  pass: { text: "Ready", cls: "bg-[var(--adm-success-bg)] text-[var(--adm-success)]" },
  warn: { text: "Attention", cls: "bg-[var(--adm-warning-bg)] text-[var(--adm-warning)]" },
  fail: { text: "Blocked", cls: "bg-[var(--adm-danger-bg)] text-[var(--adm-danger)]" },
} as const;

const OWNER_TEXT = {
  engineering: "Engineering",
  merchant: "You can fix this in Admin",
  "owner-approval": "Needs owner approval",
} as const;

/** Server-rendered checkout gate matrix. Shows flag NAMES and states only, never secret values. */
export function CheckoutReadinessPanel({ readiness }: { readiness: Readiness }) {
  return (
    <section
      aria-labelledby="checkout-readiness-h"
      data-testid="checkout-readiness"
      className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="checkout-readiness-h" className="font-[family-name:var(--font-display)] text-lg font-bold">
            COD checkout readiness
          </h2>
          <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
            Customers can place orders only when every blocking gate is ready. Each gate is checked on the server.
          </p>
        </div>
        <span
          data-testid="checkout-readiness-status"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${readiness.open ? STATE_STYLE.pass.cls : STATE_STYLE.fail.cls}`}
        >
          {readiness.open ? "Ordering open" : `Ordering closed · ${readiness.blockingFailures.length} blocking`}
        </span>
      </div>
      <ul className="mt-4 divide-y divide-[var(--adm-divider)]">
        {readiness.gates.map((g) => (
          <li key={g.id} data-gate={g.id} data-state={g.state} className="flex flex-wrap items-start gap-3 py-3">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_STYLE[g.state].cls}`}>
              {STATE_STYLE[g.state].text}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                {g.label}
                {!g.blocking ? <span className="ml-2 text-xs font-normal text-[var(--adm-ink-2)]">(advisory)</span> : null}
              </p>
              <p className="mt-0.5 text-sm text-[var(--adm-ink-2)] [overflow-wrap:anywhere]">{g.detail}</p>
              {g.state !== "pass" ? (
                <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
                  {OWNER_TEXT[g.owner]}
                  {g.fixHref ? (
                    <>
                      {" · "}
                      <Link href={g.fixHref} className="font-semibold text-[var(--adm-focus)] underline">
                        Open
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
