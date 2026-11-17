import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Old preview address: the full homepage preview now lives inside the storefront layout. */
export default async function OldDraftPreviewPage() {
  await requireStaffPage(["owner", "admin", "editor"]);
  redirect("/preview/homepage?v=draft");
}
