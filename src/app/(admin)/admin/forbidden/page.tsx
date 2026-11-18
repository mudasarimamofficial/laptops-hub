import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ reason?: string }> };

export default async function AdminForbiddenPage({ searchParams }: Props) {
  const reason = (await searchParams).reason;
  const copy =
    reason === "role"
      ? {
          title: "Not allowed for this role",
          body: "You are signed in as staff, but this page needs a different role. Ask an owner or admin if you need access.",
        }
      : reason === "membership"
        ? {
            title: "Staff access required",
            body: "You are signed in, but this account is not an active staff member. Admin data is never shown without an active membership.",
          }
        : {
            title: "Access denied",
            body: "You do not have permission to open this admin page.",
          };

  return (
    <div className="lh-content flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--adm-danger)]">
        403
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
        {copy.title}
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--adm-ink-2)]">{copy.body}</p>
      <div className="mt-8 flex gap-4 text-sm font-semibold">
        <Link href="/" className="text-[var(--adm-action)]">
          Storefront
        </Link>
        <Link href="/admin" className="text-[var(--adm-action)]">
          Overview
        </Link>
        <Link href="/admin/login" className="text-[var(--adm-action)]">
          Staff login
        </Link>
      </div>
    </div>
  );
}
