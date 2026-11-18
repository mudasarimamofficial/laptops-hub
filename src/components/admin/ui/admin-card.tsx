import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  id?: string;
};

/** Standard admin surface card — Shopify-style section grouping. */
export function AdminCard({ title, description, children, className = "", actions, id }: Props) {
  return (
    <section
      id={id}
      className={`rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] sm:p-5 ${className}`}
    >
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-[var(--adm-ink)]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-[var(--adm-ink-2)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
