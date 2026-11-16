import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { publicWriteBlockedResponse } from "@/lib/security/public-write-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { processReview } from "@/lib/validation/review";

/**
 * Public review submission. Stored as `pending` with the service role (anon has no INSERT grant) and shown only after
 * staff approval. Rate limited per hashed IP (3 per hour); the raw IP is never stored.
 */
export async function POST(request: Request) {
  const blocked = publicWriteBlockedResponse();
  if (blocked) return blocked;
  const supabase = createServiceClient();
  const result = await processReview(
    {
      origin: request.headers.get("origin"),
      url: request.url,
      host: request.headers.get("x-forwarded-host") || request.headers.get("host"),
      ip: clientIp(request),
      body: await request.json().catch(() => null),
    },
    {
      rateLimit: (key) => rateLimit(key, { limit: 3, windowMs: 60 * 60 * 1000 }),
      hashIp: (ip) => createHash("sha256").update(`review:${ip}`).digest("hex").slice(0, 32),
      productIdFor: async (handle) => {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("handle", handle)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();
        return data?.id ?? null;
      },
      insert: async (row) => {
        const { error } = await supabase.from("product_reviews").insert(row);
        return { error: error ? error.message : null };
      },
    },
  );
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store", ...result.headers } });
}
