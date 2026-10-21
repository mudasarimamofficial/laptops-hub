import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  status: z.enum(["pending", "draft", "published"]),
  bodyHtml: z.string().max(100_000),
});

/** Strip script/style tags — content is merchant HTML, not free XSS. */
function sanitizeHtml(input: string): string {
  return input
    .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[\s\S]*?>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { slug } = await ctx.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const body_html = sanitizeHtml(parsed.data.bodyHtml);
    const { data: existing, error: findErr } = await supabase
      .from("content_pages")
      .select("slug, title, status")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr || !existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("content_pages")
      .update({
        title: parsed.data.title,
        status: parsed.data.status,
        body_html,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "content.patch",
      entity_type: "content_pages",
      entity_id: slug,
      before: existing,
      after: { title: parsed.data.title, status: parsed.data.status },
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
