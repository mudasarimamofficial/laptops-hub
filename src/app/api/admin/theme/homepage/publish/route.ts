import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

const schema = z.object({
  /** Explicit confirmation — publish changes public storefront when wired. */
  confirmPublish: z.literal(true),
  versionId: z.string().uuid().optional(),
});

/**
 * Publish homepage draft → theme_publications pointer.
 * Blocked on non-local Supabase (Production publish needs owner approval + storefront wire).
 */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin"]);
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "confirm_required", message: "confirmPublish:true required." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isLocal = /127\.0\.0\.1|localhost|\[::1\]/.test(supabaseUrl);
    if (!isLocal) {
      return NextResponse.json(
        {
          error: "production_publish_blocked",
          message: "Theme publish is blocked against non-local databases until owner-approved go-live.",
        },
        { status: 403 },
      );
    }

    const { data: template } = await supabase.from("theme_templates").select("id, key").eq("key", "homepage").maybeSingle();
    if (!template) {
      return NextResponse.json({ error: "migration_required" }, { status: 409 });
    }

    let versionId = parsed.data.versionId;
    if (!versionId) {
      const { data: draft } = await supabase
        .from("theme_versions")
        .select("id, sections")
        .eq("template_id", template.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!draft) return NextResponse.json({ error: "no_draft" }, { status: 404 });
      versionId = draft.id;

      // Snapshot as published version row
      const { data: published, error } = await supabase
        .from("theme_versions")
        .insert({
          template_id: template.id,
          label: `published-${Date.now()}`,
          status: "published",
          sections: draft.sections,
          created_by: staff.userId,
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !published) {
        return NextResponse.json({ error: error?.message || "publish_failed" }, { status: 500 });
      }
      versionId = published.id;
    }

    const { error: pubErr } = await supabase.from("theme_publications").upsert({
      template_key: "homepage",
      published_version_id: versionId,
      updated_at: new Date().toISOString(),
      updated_by: staff.userId,
    });
    if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "theme.homepage.publish",
      entity_type: "theme_publications",
      entity_id: "homepage",
      after: { versionId },
    });

    return NextResponse.json(
      {
        ok: true,
        publishedVersionId: versionId,
        notice: "Published on local stack. Storefront reads published pointer when THEME_PUBLISHED_ENABLED=1.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
