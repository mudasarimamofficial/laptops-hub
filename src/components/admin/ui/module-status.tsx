import Link from "next/link";

type Props = {
  title: string;
  phase: string;
  summary: string;
  availableNow?: { label: string; href: string }[];
  nextSteps?: string[];
};

/** Honest in-progress module page — real links only, no fake KPIs. */
export function ModuleStatusPanel({ title, phase, summary, availableNow, nextSteps }: Props) {
  return (
    <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
        {phase}
      </p>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-[var(--adm-ink-2)]">{summary}</p>
      {availableNow && availableNow.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">Available now</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-[var(--lh-action)]">
            {availableNow.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="hover:underline">
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {nextSteps && nextSteps.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">Engineering next</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--adm-ink)]">
            {nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
