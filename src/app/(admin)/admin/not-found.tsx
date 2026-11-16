import Link from "next/link";

export const metadata = { title: "Not found" };

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">404</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--adm-ink)]">This admin page doesn’t exist</h1>
      <p className="mt-2 text-sm text-[var(--adm-ink-2)]">The link may be out of date, or the section was renamed.</p>
      <Link href="/admin" className="lh-btn lh-btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
