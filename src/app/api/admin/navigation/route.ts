import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import {
  DEFAULT_NAVIGATION_CONFIG,
  getPublishedNavigation,
  isSafeDestinationUrl,
  type NavigationConfig,
} from "@/lib/content/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const navItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(240).refine(isSafeDestinationUrl, {
    message: "Invalid or restricted destination URL. Admin routes and javascript: schemas are forbidden.",
  }),
  isNew: z.boolean().optional(),
  type: z.enum(["collection", "page", "guide", "product", "custom"]).optional(),
});

const footerColSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(80),
  links: z.array(navItemSchema),
});

const putSchema = z.object({
  headerNav: z.array(navItemSchema),
  footerColumns: z.array(footerColSchema),
});

/**
 * Fetch current published navigation and default V5 configuration.
 */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "editor", "manager"]);
    const current = await getPublishedNavigation(supabase);

    // Fetch active collections and content pages to populate destination pickers
    const { data: collections } = await supabase
      .from("collections")
      .select("slug, title")
      .order("title");

    const { data: pages } = await supabase
      .from("content_pages")
      .select("slug, title, is_published, legal_approved")
      .order("title");

    return NextResponse.json(
      {
        ok: true,
        navigation: current,
        defaults: DEFAULT_NAVIGATION_CONFIG,
        availableDestinations: {
          collections: collections || [],
          pages: pages || [],
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/**
 * Save and publish merchant navigation configuration.
 */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "editor"]);
    const body = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: "Invalid navigation structure",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const current = await getPublishedNavigation(supabase);
    const nextVersion = (current.version || 1) + 1;
    const now = new Date().toISOString();

    const newConfig: NavigationConfig = {
      headerNav: parsed.data.headerNav,
      footerColumns: parsed.data.footerColumns,
      version: nextVersion,
      updatedAt: now,
    };

    const { error: upsertErr } = await supabase
      .from("store_settings")
      .upsert(
        {
          key: "navigation",
          value: newConfig,
          updated_at: now,
          updated_by: staff.userId,
        },
        { onConflict: "key" },
      );

    if (upsertErr) {
      return NextResponse.json(
        {
          error: "persistence_failed",
          message: `Failed to save navigation: ${upsertErr.message}`,
        },
        { status: 500 },
      );
    }

    // Verify fresh read
    const verified = await getPublishedNavigation(supabase);
    if (verified.version !== nextVersion) {
      return NextResponse.json(
        {
          error: "verification_failed",
          message: "Navigation was saved but database readback version did not match.",
        },
        { status: 500 },
      );
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "navigation.update",
      entity_type: "store_settings",
      entity_id: "navigation",
      after: {
        version: nextVersion,
        headerItemCount: newConfig.headerNav.length,
        footerColumnCount: newConfig.footerColumns.length,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin/navigation");

    return NextResponse.json(
      {
        ok: true,
        navigation: verified,
        message: "Navigation configuration published successfully.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/**
 * Reset navigation to V5 canonical defaults.
 */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
    const body = await request.json().catch(() => null);
    if (body?.action !== "restore_defaults") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const current = await getPublishedNavigation(supabase);
    const nextVersion = (current.version || 1) + 1;

    const resetConfig: NavigationConfig = {
      ...DEFAULT_NAVIGATION_CONFIG,
      version: nextVersion,
      updatedAt: now,
    };

    const { error: resetErr } = await supabase
      .from("store_settings")
      .upsert(
        {
          key: "navigation",
          value: resetConfig,
          updated_at: now,
          updated_by: staff.userId,
        },
        { onConflict: "key" },
      );

    if (resetErr) {
      return NextResponse.json({ error: "reset_failed", message: resetErr.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "navigation.restore_defaults",
      entity_type: "store_settings",
      entity_id: "navigation",
      after: { version: nextVersion },
    });

    revalidatePath("/");
    revalidatePath("/admin/navigation");

    return NextResponse.json(
      {
        ok: true,
        navigation: resetConfig,
        message: "Navigation restored to approved V5 defaults.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
