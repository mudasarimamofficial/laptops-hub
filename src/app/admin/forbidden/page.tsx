import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default function AdminForbiddenPage() {
  return (
    <div className="lh-content flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--lh-error)]">
        403
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
        Staff access required
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--lh-ink-2)]">
        You are signed in, but this account is not an active staff member. Admin data is never shown without an active
        membership.
      </p>
      <div className="mt-8 flex gap-4 text-sm font-semibold">
        <Link href="/" className="text-[var(--lh-action)]">
          Storefront
        </Link>
        <Link href="/admin/login" className="text-[var(--lh-action)]">
          Staff login
        </Link>
      </div>
    </div>
  );
}
