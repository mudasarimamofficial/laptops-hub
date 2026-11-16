import Link from "next/link";

type Props = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel }: Props) {
  return (
    <div className="rounded-[var(--adm-radius-lg)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] px-6 py-14 text-center">
      <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--adm-ink)]">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-[var(--adm-ink-2)]">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
