import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff, staffErrorResponse } from "@/lib/auth/staff";
import { assertMerchantMutationAllowedAsync } from "@/lib/security/merchant-write-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { mapDiscountRow } from "@/lib/commerce/discounts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCOUNT_ROLES = ["owner", "admin", "manager"] as const;

/** "" (a new campaign in the form) means "create". */
const optionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional());
/** ISO date-time with "Z" or an offset: Postgres returns stored values as "…+00:00". */
const isoDateTime = z.string().datetime({ offset: true });

const upsertSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  kind: z.enum(["percent", "fixed_paisa"]),
  value: z.number().int().positive(),
  // Product/collection targeting is reserved in the schema but not yet fully wired
  // across storefront + COD. Reject non-storewide writes so admin cannot create
  // campaigns that silently apply (or fail to apply) incorrectly.
  scope: z.literal("storewide").default("storewide"),
  status: z.enum(["draft", "active", "scheduled", "expired", "disabled"]),
  startsAt: isoDateTime.nullable().optional(),
  endsAt: isoDateTime.nullable().optional(),
  announcement: z.string().trim().max(280).optional().default(""),
  showAnnouncement: z.boolean().optional().default(true),
  codeRequired: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    await requireStaff([...DISCOUNT_ROLES]);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("discount_campaigns")
    .select(
      "id, name, description, kind, value, scope, status, starts_at, ends_at, announcement, show_announcement, code_required, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  return NextResponse.json(
    { campaigns: (data || []).map((r) => mapDiscountRow(r as Parameters<typeof mapDiscountRow>[0])) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let staff;
  try {
    staff = await requireStaff([...DISCOUNT_ROLES]);
    // Same Preview→Production write guard as every other merchant write route.
    await assertMerchantMutationAllowedAsync("admin_write");
  } catch (e) {
    return staffErrorResponse(e);
  }
  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  if (d.kind === "percent" && (d.value < 1 || d.value > 90)) {
    return NextResponse.json({ error: "invalid_percent" }, { status: 400 });
  }
  // Fixed amounts are paisa: Rs 1 – Rs 1,000,000 (also keeps the value far inside the integer column).
  if (d.kind === "fixed_paisa" && (d.value < 100 || d.value > 100_000_000)) {
    return NextResponse.json({ error: "invalid_fixed_amount" }, { status: 400 });
  }
  if (d.status === "scheduled" && !d.startsAt) {
    return NextResponse.json({ error: "scheduled_requires_starts_at" }, { status: 400 });
  }
  if (d.startsAt && d.endsAt && Date.parse(d.endsAt) <= Date.parse(d.startsAt)) {
    return NextResponse.json({ error: "invalid_schedule_window" }, { status: 400 });
  }
  const sb = createServiceClient();
  const row = {
    name: d.name,
    description: d.description,
    kind: d.kind,
    value: d.value,
    scope: "storewide" as const,
    status: d.status,
    starts_at: d.startsAt ?? null,
    ends_at: d.endsAt ?? null,
    announcement: d.announcement,
    show_announcement: d.showAnnouncement,
    code_required: d.codeRequired,
    updated_by: staff.userId,
    updated_at: new Date().toISOString(),
  };

  if (d.id) {
    const { data, error } = await sb.from("discount_campaigns").update(row).eq("id", d.id).select("*").maybeSingle();
    if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await sb.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "discount.update",
      entity_type: "discount_campaign",
      entity_id: d.id,
      after: { name: d.name, status: d.status, value: d.value },
    }).then(() => null, () => null);
    refreshStorefrontPrices();
    return NextResponse.json({ campaign: mapDiscountRow(data as Parameters<typeof mapDiscountRow>[0]) });
  }

  const { data, error } = await sb
    .from("discount_campaigns")
    .insert({ ...row, created_by: staff.userId })
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "create_failed", message: error.message }, { status: 500 });
  await sb.from("audit_logs").insert({
    actor_user_id: staff.userId,
    action: "discount.create",
    entity_type: "discount_campaign",
    entity_id: data?.id ?? null,
    after: { name: d.name, status: d.status, value: d.value },
  }).then(() => null, () => null);
  refreshStorefrontPrices();
  return NextResponse.json({ campaign: mapDiscountRow(data as Parameters<typeof mapDiscountRow>[0]) }, { status: 201 });
}

/**
 * Product and collection pages are regenerated at most every 60 s, while checkout prices from the live campaign.
 * Refresh the storefront now so shown prices and the COD total agree right after a discount change.
 */
function refreshStorefrontPrices() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Outside a request scope (tests): pages still refresh within 60 s.
  }
}
