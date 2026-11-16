import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; signed_out?: string }> }) {
  const { reset, signed_out } = await searchParams;
  return <AdminLoginForm justReset={reset === "1"} signedOut={signed_out === "1"} />;
}
