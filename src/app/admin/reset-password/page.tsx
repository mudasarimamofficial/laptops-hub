import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isFreshRecoverySession, MIN_PASSWORD_LENGTH } from "@/lib/auth/recovery";
import { ResetPasswordForm } from "./reset-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const ready = !!user && !!session && session.user.id === user.id && isFreshRecoverySession(session.access_token);

  return (
    <div className="lh-content flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-8 shadow-sm">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Set a new password</h1>
        {ready ? (
          <>
            <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
              For <span className="font-medium">{user!.email}</span>. At least {MIN_PASSWORD_LENGTH} characters; a password
              manager is best. Afterwards every device is signed out and you sign in again.
            </p>
            <ResetPasswordForm />
          </>
        ) : (
          <>
            <p role="alert" className="mt-3 text-sm text-[var(--lh-error)]">
              This page needs a valid reset link from your email, used within 15 minutes.
            </p>
            <Link href="/admin/forgot-password" className="lh-btn lh-btn-primary mt-6 inline-flex w-full justify-center">
              Request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
