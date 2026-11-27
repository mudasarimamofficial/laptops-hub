import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { V5_CONTENT } from "@/lib/content/v5-content";
import { revalidateContent, saveErrorResponse } from "@/lib/content/admin-save";

const schema = z.object({
  title: z.string().trim().min(2, "Give the page a title.").max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single hyphens for the address.")
    .min(2)
    .max(80),
});

/** G19: create a new content page as a draft (not public until published with a body). */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: parsed.error.issues[0]?.message || "Check the title and address." }, { status: 400 });
    }
    if (V5_CONTENT.pages[parsed.data.slug]) {
      return NextResponse.json({ error: "slug_taken", message: "That address belongs to a built-in page." }, { status: 409 });
    }
    const { data, error } = await supabase.rpc("create_content_page", {
      payload: { actor_user_id: staff.userId, slug: parsed.data.slug, title: parsed.data.title },
    });
    if (error) return saveErrorResponse(error);
    revalidateContent();
    return NextResponse.json({ ok: true, slug: (data as { slug: string }).slug, message: "Draft page created." }, { status: 201 });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
