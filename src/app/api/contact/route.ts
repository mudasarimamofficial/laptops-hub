import { randomUUID } from "crypto";
import { after, NextResponse } from "next/server";
import { publicWriteBlockedResponse } from "@/lib/security/public-write-guard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { processContact } from "@/lib/validation/contact";
import { loadNotificationSettings } from "@/lib/notify/settings-server";
import { processOutbox } from "@/lib/notify/outbox";

/**
 * G24: when Settings › Notifications › inquiry alerts is on, a stored inquiry also queues a staff-only alert in
 * notification_outbox (template contact_inquiry; retried like order alerts). Queueing never blocks or fails the
 * inquiry itself, and the person who wrote in is never emailed.
 */
async function queueInquiryAlert(inquiryId: string) {
  try {
    const settings = await loadNotificationSettings();
    if (!settings.inquiryAlerts) return;
    const { error } = await createServiceClient()
      .from("notification_outbox")
      .insert({ order_id: null, channel: "email", template: "contact_inquiry", payload: { inquiry_id: inquiryId } });
    if (error) return;
    after(() => processOutbox({ limit: 3 }).then(() => undefined, () => undefined));
  } catch {
    /* alerts are best effort; the inquiry is already stored and visible in /admin/inquiries */
  }
}

export async function POST(request: Request) {
  const blocked = publicWriteBlockedResponse();
  if (blocked) return blocked;
  let storedId: string | null = null;
  const result = await processContact(
    {
      origin: request.headers.get("origin"),
      url: request.url,
      host: request.headers.get("x-forwarded-host") || request.headers.get("host"),
      ip: clientIp(request),
      body: await request.json().catch(() => null),
    },
    {
      rateLimit: (key) => rateLimit(key, { limit: 5, windowMs: 15 * 60 * 1000 }),
      // Anon insert-only RLS (`inquiries_anon_insert`); rows are read by staff in /admin/inquiries. The id is chosen
      // here because the public role cannot read the row back.
      insert: async (row) => {
        const id = randomUUID();
        const supabase = await createClient();
        const { error } = await supabase.from("contact_inquiries").insert({ id, ...row });
        if (!error) storedId = id;
        return { error: error ? error.message : null };
      },
    },
  );
  if (storedId && result.status === 200) await queueInquiryAlert(storedId);
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store", ...result.headers } });
}
