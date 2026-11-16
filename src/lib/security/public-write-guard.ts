import { NextResponse } from "next/server";
import { evaluateMerchantWritePolicy } from "./merchant-write-guard";

/**
 * Fail-closed guard for PUBLIC and AUTH write routes (contact, reviews, COD orders, staff password recovery/change,
 * export audit rows). Staff merchant writes already go through `createAuthorizedStaffWriter`; this covers everything
 * else, so a Preview deployment (or any deployment with MERCHANT_MUTATIONS_DISABLED=1) can never insert rows, send
 * auth emails or change passwords on the Production Supabase project.
 *
 * Same policy as staff writes (`evaluateMerchantWritePolicy`):
 *   - local CLI Supabase with verified local keys → allowed
 *   - Vercel production + Production Supabase      → allowed
 *   - Preview/development against Production       → refused
 *   - MERCHANT_MUTATIONS_DISABLED=1                → refused
 *   - unknown remote without MERCHANT_WRITES_ALLOW_REMOTE=1 on a non-production project → refused
 */
export function publicWritesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return evaluateMerchantWritePolicy(env).allowed;
}

/** `null` when the write may proceed; otherwise a 503 the storefront forms already show as a generic failure. */
export function publicWriteBlockedResponse(env: NodeJS.ProcessEnv = process.env): NextResponse | null {
  if (publicWritesAllowed(env)) return null;
  return NextResponse.json(
    {
      error: "preview_read_only",
      message: "This preview is read-only. Nothing was sent or saved.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
