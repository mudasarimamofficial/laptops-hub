import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { isCrossSite } from "@/lib/validation/contact";
import { TESTIMONIAL_APPROVE_ROLES, testimonialImportItemSchema } from "@/lib/content/testimonials";
import snapshot from "@/data/google-reviews-import-candidates.json";

const crossSite = (r: Request) =>
  isCrossSite(r.headers.get("origin"), r.url, r.headers.get("x-forwarded-host") || r.headers.get("host"));

/**
 * Owner/admin/manager only: import the static Google HTML snapshot as draft testimonials.
 * Never publishes. Never attaches avatars (permission pending). Dedupes on author+body+date.
 */
export async function POST(request: Request) {
  if (crossSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(TESTIMONIAL_APPROVE_ROLES);
    const list = Array.isArray(snapshot.candidates) ? snapshot.candidates : [];
    if (list.length === 0) {
      return NextResponse.json({ error: "empty", message: "No candidates found in the import snapshot." }, { status: 400 });
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const c of list) {
      const noteBase =
        c.verificationNote ||
        "Imported from laptops-hub-google-reviews.source.html. Verify on live GBP; attach Maps URL; confirm consent/avatar before publish.";
      const note =
        c.avatarPhotoId && !noteBase.includes(c.avatarPhotoId)
          ? `${noteBase} Avatar photo id (pending permission): ${c.avatarPhotoId}`
          : noteBase;

      const parsed = testimonialImportItemSchema.safeParse({
        authorName: c.authorName,
        rating: c.rating,
        body: c.body,
        reviewDate: c.reviewDate || "",
        source: "google",
        sourceUrl: "",
        verificationNote: note.slice(0, 1000),
        showOnHomepage: true,
        featured: false,
        sortOrder: c.sortOrder ?? 0,
      });
      if (!parsed.success) {
        errors.push(`${c.authorName}: invalid`);
        continue;
      }

      let existingQuery = supabase
        .from("store_testimonials")
        .select("id")
        .eq("author_name", parsed.data.authorName)
        .eq("body", parsed.data.body)
        .limit(1);
      existingQuery = parsed.data.reviewDate
        ? existingQuery.eq("review_date", parsed.data.reviewDate)
        : existingQuery.is("review_date", null);

      const { data: existing } = await existingQuery.maybeSingle();
      if (existing?.id) {
        skipped += 1;
        continue;
      }

      const row = {
        author_name: parsed.data.authorName,
        rating: parsed.data.rating,
        body: parsed.data.body,
        review_date: parsed.data.reviewDate || null,
        source: "google" as const,
        source_url: null,
        avatar_url: null,
        avatar_permission: false,
        consent_confirmed: false,
        verification_note: parsed.data.verificationNote,
        show_on_homepage: parsed.data.showOnHomepage,
        featured: parsed.data.featured,
        sort_order: parsed.data.sortOrder,
        status: "draft" as const,
        created_by: staff.userId,
        updated_by: staff.userId,
      };

      const { data, error } = await supabase.from("store_testimonials").insert(row).select("id").single();
      if (error || !data) {
        errors.push(`${parsed.data.authorName}: save failed`);
        continue;
      }
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "testimonial.import_google_snapshot",
        entity_type: "store_testimonials",
        entity_id: data.id,
        after: { status: "draft", source: "google", published: false },
      });
      inserted += 1;
    }

    return NextResponse.json(
      {
        ok: true,
        inserted,
        skipped,
        errors: errors.slice(0, 10),
        message: `Imported ${inserted} unpublished draft(s); skipped ${skipped} already present. Nothing published — verify each before publish.`,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
