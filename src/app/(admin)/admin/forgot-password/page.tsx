import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Reset staff password", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  return (
    <div className="lh-content flex min-h-[60vh] items-center justify-center py-12">
      <ForgotPasswordForm linkInvalid={link === "invalid"} />
    </div>
  );
}
