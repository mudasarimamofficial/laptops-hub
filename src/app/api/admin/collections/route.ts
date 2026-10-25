import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120)
    .optional(),
  description: z.string().max(4000).optional(),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  collectionType: z.enum(["manual", "automated"]).default("manual"),
  rule: z.record(z.string(), z.unknown()).optional(),
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { data, error } = await supabase
      .from("collections")
      .select("id, slug, title, published, featured, rule, sort_order, description")
      .order("sort_order")
      .order("title");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ collections: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Check title and slug." }, { status: 400 });
    }

    let slug = parsed.data.slug || slugify(parsed.data.title);
    if (!slug) {
      return NextResponse.json({ error: "validation_failed", message: "Could not derive slug." }, { status: 400 });
    }

    for (let i = 0; i < 8; i++) {
      const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
      const { data: existing } = await supabase.from("collections").select("id").eq("slug", candidate).maybeSingle();
      if (!existing) {
        slug = candidate;
        break;
      }
      if (i === 7) {
        return NextResponse.json({ error: "slug_conflict" }, { status: 409 });
      }
    }

    const rule =
      parsed.data.collectionType === "automated"
        ? parsed.data.rule && Object.keys(parsed.data.rule).length
          ? parsed.data.rule
          : { match: "all", conditions: [] }
        : {};

    const insert: Record<string, unknown> = {
      slug,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      published: parsed.data.published,
      featured: parsed.data.featured,
      rule,
      sort_order: 0,
    };
    if (parsed.data.collectionType) {
      insert.collection_type = parsed.data.collectionType;
    }

    let { data, error } = await supabase.from("collections").insert(insert).select("id, slug, title").single();
    if (error?.message?.includes("collection_type")) {
      delete insert.collection_type;
      const retry = await supabase.from("collections").insert(insert).select("id, slug, title").single();
      data = retry.data;
      error = retry.error;
    }
    if (error || !data) {
      return NextResponse.json({ error: error?.message || "create_failed" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "collection.create",
      entity_type: "collections",
      entity_id: data.id,
      after: { slug: data.slug, title: data.title, type: parsed.data.collectionType },
    });

    return NextResponse.json({ ok: true, slug: data.slug, id: data.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
