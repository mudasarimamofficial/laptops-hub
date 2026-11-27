import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/** Database error codes from save_content_page / create_content_page (migration 20261126160000) → merchant messages. */
export const SAVE_ERRORS: Record<string, [number, string]> = {
  stale_version: [409, "This page was changed in another window or by someone else. Reload to see the latest version; nothing was saved."],
  legal_forbidden: [403, "Only the owner, an admin or a manager can approve or publish policy pages."],
  legal_approval_required: [409, "Legal/business pages need explicit owner approval before publish."],
  slug_locked: [409, "Policy page addresses cannot be changed, and no page can take a policy address."],
  slug_invalid: [400, "Use lower-case letters, numbers and single hyphens for the address (2–80 characters)."],
  slug_taken: [409, "Another page already uses that address."],
  seo_too_long: [400, "Search title is limited to 120 characters and search description to 320."],
  not_found: [404, "Page not found."],
  forbidden: [403, "Your role cannot edit content pages."],
  validation_failed: [400, "Check the title and status and try again."],
};

export function saveErrorResponse(error: { message?: string; code?: string }) {
  const msg = error.message || "";
  if (error.code === "PGRST202" || error.code === "42883" || /(save|create)_content_page/.test(msg)) {
    return NextResponse.json(
      { error: "not_available", message: "Page history is not switched on yet (database update pending). Nothing was saved." },
      { status: 503 },
    );
  }
  const key = Object.keys(SAVE_ERRORS).find((k) => msg.includes(k));
  if (key) return NextResponse.json({ error: key, message: SAVE_ERRORS[key][1] }, { status: SAVE_ERRORS[key][0] });
  return NextResponse.json({ error: "server_error", message: "The change could not be saved. Try again." }, { status: 500 });
}

/** Expire every cache that shows content pages or links to them (header/footer links, sitemap, content routes). */
export function revalidateContent() {
  revalidateTag("content", { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/(storefront)", "layout");
  revalidatePath("/compare");
  revalidatePath("/compare", "page");
  revalidatePath("/sitemap.xml");
}
