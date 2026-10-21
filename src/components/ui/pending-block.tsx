export function PendingBlock({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <aside
      className="rounded-[var(--lh-radius-card)] border border-dashed border-[var(--lh-warning)] bg-[var(--lh-warning-bg)] p-5"
      role="note"
    >
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--lh-warning)]">
        Pending business approval
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--lh-ink)]">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-[var(--lh-ink-2)]">
        {children ??
          "This content is waiting for owner-approved copy. We will not invent policies, fees, or company claims."}
      </div>
    </aside>
  );
}
