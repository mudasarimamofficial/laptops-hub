import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { emailConfigured } from "@/lib/notify/send-email";
import {
  NOTIFICATIONS_KEY,
  maskEmail,
  normaliseRecipients,
  notificationSettingsSchema,
  parseNotificationSettings,
  toStored,
} from "@/lib/notify/settings";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** Summary for the audit log: no addresses, only what changed in kind. */
function auditView(v: ReturnType<typeof toStored> | null) {
  if (!v) return null;
  return {
    recipients: v.recipients.length,
    customer_mode: v.customer_mode,
    inquiry_alerts: v.inquiry_alerts,
    custom_order_subject: !!v.order_subject,
    custom_customer_subject: !!v.customer_subject,
    custom_customer_intro: !!v.customer_intro,
  };
}

/** Owner/admin: current notification settings plus provider status (never the provider key). */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin"]);
    const { data, error } = await supabase.from("store_settings").select("value, updated_at").eq("key", NOTIFICATIONS_KEY).maybeSingle();
    if (error) return NextResponse.json({ error: "database_error", message: "Settings could not be loaded." }, { status: 500, headers: noStore });
    const effective = parseNotificationSettings(data?.value ?? null);
    const envFallback = normaliseRecipients((process.env.STORE_NOTIFY_EMAIL || "").split(","));
    return NextResponse.json(
      {
        ok: true,
        stored: !!data,
        updatedAt: data?.updated_at ?? null,
        // The hosting fallback address is shown masked, as on the Settings page.
        settings: effective.source === "env" ? { ...effective, recipients: effective.recipients.map(maskEmail) } : effective,
        provider: { configured: emailConfigured(), sender: process.env.STORE_FROM_EMAIL || null },
        fallbackRecipients: envFallback.map(maskEmail),
      },
      { headers: noStore },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Owner/admin save. Turning customer emails fully on is owner-only (it emails real customers). */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
    const parsed = notificationSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const invalidEmail = parsed.error.issues.some((i) => i.message === "invalid_email");
      return NextResponse.json(
        {
          error: "validation_failed",
          message: invalidEmail ? "One of the email addresses is not valid." : "Check the notification settings and try again.",
        },
        { status: 400, headers: noStore },
      );
    }
    const { data: current } = await supabase.from("store_settings").select("value").eq("key", NOTIFICATIONS_KEY).maybeSingle();
    const before = current?.value ? parseNotificationSettings(current.value) : null;
    const next = toStored(parsed.data);
    const currentMode = (before ?? parseNotificationSettings(null)).customerMode;
    if (next.customer_mode === "on" && currentMode !== "on" && staff.role !== "owner") {
      return NextResponse.json(
        { error: "owner_required", message: "Only the owner can start emailing customers. Use test mode to preview the customer email." },
        { status: 403, headers: noStore },
      );
    }

    const { error } = await supabase
      .from("store_settings")
      .upsert({ key: NOTIFICATIONS_KEY, value: next, updated_at: new Date().toISOString(), updated_by: staff.userId }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: "persistence_failed", message: "Settings were not saved. Try again." }, { status: 500, headers: noStore });

    const { data: verified } = await supabase.from("store_settings").select("value").eq("key", NOTIFICATIONS_KEY).maybeSingle();
    if (!verified) return NextResponse.json({ error: "verification_failed", message: "Saved, but could not be confirmed. Reload the page." }, { status: 500, headers: noStore });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "notifications.settings.update",
      entity_type: "store_settings",
      before: before
        ? auditView(toStored({ ...before, recipients: before.source === "settings" ? before.recipients : [] }))
        : null,
      after: auditView(next),
    });

    return NextResponse.json({ ok: true, settings: parseNotificationSettings(verified.value) }, { headers: noStore });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
