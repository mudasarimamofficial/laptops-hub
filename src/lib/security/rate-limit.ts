import { createServiceClient } from "@/lib/supabase/server";

/** In-memory fallback when DB rate limit is unavailable (dev / cold start). */
const memory = new Map<string, { timestamps: number[] }>();

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Durable rate limit via Postgres `consume_rate_limit` when service role is available.
 * Falls back to process memory so local/dev still throttles.
 */
export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<{ ok: true; remaining?: number } | { ok: false; retryAfterSec: number }> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (!error && typeof data === "boolean") {
      if (data) return { ok: true, remaining: Math.max(0, limit - 1) };
      return { ok: false, retryAfterSec: windowSeconds };
    }
  } catch {
    /* fall through to memory */
  }

  const now = Date.now();
  const bucket = memory.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    memory.set(key, bucket);
    return { ok: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  memory.set(key, bucket);
  return { ok: true, remaining: limit - bucket.timestamps.length };
}
