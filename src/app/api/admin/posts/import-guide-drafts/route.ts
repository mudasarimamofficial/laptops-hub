import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { isCrossSite } from "@/lib/validation/contact";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { guideDraftSeeds } from "@/lib/content/blog-guide-drafts";
import { sanitizeCmsHtml } from "@/lib/security/sanitize-html";

const crossSite = (r: Request) =>
  isCrossSite(r.headers.get("origin"), r.url, r.headers.get("x-forwarded-host") || r.headers.get("host"));

/**
 * Seed the four V5 guide templates as unpublished drafts. Never publishes.
 * Skips slugs that already exist. Staff must review and publish from Admin → Blog.
 */
export async function POST(request: Request) {
  if (crossSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(POST_STAFF_ROLES);
    const seeds = guideDraftSeeds();
    let inserted = 0;
    let skipped = 0;

    for (const s of seeds) {
      const { data: existing } = await supabase.from("articles").select("id").eq("slug", s.slug).maybeSingle();
      if (existing?.id) {
        skipped += 1;
        continue;
      }
      const body = sanitizeCmsHtml(s.bodyHtml);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("articles")
        .insert({
          slug: s.slug,
          title: s.title,
          excerpt: s.excerpt,
          body_html: body,
          status: "draft",
          published_at: null,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error || !data) {
        continue;
      }
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "post.import_guide_draft",
        entity_type: "articles",
        entity_id: data.id,
        after: { slug: s.slug, status: "draft", published: false },
      });
      inserted += 1;
    }

    return NextResponse.json(
      {
        ok: true,
        inserted,
        skipped,
        message: `Created ${inserted} unpublished guide draft(s); skipped ${skipped} existing. Review in Blog before publishing.`,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
