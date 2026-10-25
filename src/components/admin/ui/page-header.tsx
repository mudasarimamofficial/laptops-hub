import Link from "next/link";

type Crumb = { href?: string; label: string };

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
};

export function AdminPageHeader({ title, description, breadcrumbs, actions }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[var(--adm-ink-2)]">
            {breadcrumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-[var(--adm-ink)] hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-[var(--adm-ink)]">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em] text-[var(--adm-ink)] sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--adm-ink-2)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
