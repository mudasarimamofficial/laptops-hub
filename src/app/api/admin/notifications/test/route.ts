import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { emailConfigured, sendEmail } from "@/lib/notify/send-email";
import { OWNER_EMAIL } from "@/lib/auth/owner-identity";

export const dynamic = "force-dynamic";

/**
 * Owner-only: send a short merchant-alert smoke message to STORE_NOTIFY_EMAIL.
 * Confirms Resend + recipient config after mailbox cutovers. Does not touch order outbox rows.
 */
export async function POST() {
  try {
    const { staff } = await createAuthorizedStaffWriter(["owner"]);
    if (!emailConfigured() || !process.env.STORE_NOTIFY_EMAIL) {
      return NextResponse.json(
        { error: "not_configured", message: "RESEND_API_KEY, STORE_FROM_EMAIL and STORE_NOTIFY_EMAIL are required." },
        { status: 503 },
      );
    }

    const to = process.env.STORE_NOTIFY_EMAIL;
    const idempotencyKey = `merchant-notify-smoke-${Date.now()}`;
    const result = await sendEmail({
      to,
      subject: "Laptops HUB — merchant alert smoke test",
      text: [
        "This is a smoke test of Production merchant notifications.",
        `Requested by owner session: ${staff.email || staff.userId}`,
        `Configured permanent owner identity: ${OWNER_EMAIL}`,
        "If you received this in the permanent owner mailbox, STORE_NOTIFY_EMAIL is correctly wired.",
        "No order was created or changed.",
      ].join("\n"),
      idempotencyKey,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "send_failed", message: result.error }, { status: 502 });
    }

    return NextResponse.json(
      {
        ok: true,
        providerMessageId: result.id,
        recipientConfigured: true,
        note: "Provider accepted the message. Open the permanent owner inbox to confirm delivery.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
