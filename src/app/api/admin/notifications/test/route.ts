import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { rateLimit } from "@/lib/security/rate-limit";
import { emailConfigured, sendEmail } from "@/lib/notify/send-email";
import { loadNotificationSettings } from "@/lib/notify/settings-server";
import { testMessage } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/**
 * G24 (replaces the earlier owner-only smoke route without a UI, gap G42; same path and response fields).
 * Owner/admin: send one test message to the SAVED staff recipients. The request carries no address, so this cannot
 * be used to email anyone else, and no customer is ever emailed. Limited to 5 per hour per staff member.
 */
export async function POST() {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
    if (!emailConfigured()) {
      return NextResponse.json(
        { error: "not_configured", message: "The email provider is not connected yet (hosting settings). Nothing was sent." },
        { status: 503, headers: noStore },
      );
    }
    const settings = await loadNotificationSettings();
    if (!settings.recipients.length) {
      return NextResponse.json({ error: "no_recipients", message: "Add at least one staff email first." }, { status: 400, headers: noStore });
    }
    const limited = await rateLimit(`notify-test:${staff.userId}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many test messages. Try again later." },
        { status: 429, headers: { ...noStore, "Retry-After": String(limited.retryAfterSec) } },
      );
    }
    const r = await sendEmail({ to: settings.recipients, ...testMessage(staff.role), idempotencyKey: `notify-test-${randomUUID()}` });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "notifications.test_send",
      entity_type: "store_settings",
      after: { recipients: settings.recipients.length, accepted: r.ok, error: r.ok ? null : r.error },
    });
    if (!r.ok) {
      return NextResponse.json({ error: "send_failed", message: `The email provider refused the test message (${r.error}).` }, { status: 502, headers: noStore });
    }
    return NextResponse.json(
      { ok: true, providerMessageId: r.id, recipientConfigured: true, recipients: settings.recipients.length, message: "Accepted by the email provider. Check the staff inbox (delivery is not confirmed)." },
      { headers: noStore },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
