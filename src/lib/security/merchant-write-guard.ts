/** Production Supabase project ref — must never be mutated from Preview. */
export const PRODUCTION_SUPABASE_REF = "xvmmjkrkgznnakcobmww";

export class MerchantWriteBlockedError extends Error {
  status = 403;
  code = "merchant_writes_blocked";

  constructor(message: string) {
    super(message);
    this.name = "MerchantWriteBlockedError";
  }
}

export type MerchantWritePolicy = {
  allowed: boolean;
  reason: string;
  supabaseHost: string;
  vercelEnv: string | undefined;
  isLocalSupabase: boolean;
  isProductionSupabase: boolean;
};

function supabaseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Fail-closed policy for merchant DB mutations.
 *
 * Allowed:
 * - Local loopback Supabase (isolated engineering)
 * - Vercel Production deployment talking to Production Supabase
 *   (ordinary merchant ops after release; COD still gated separately)
 *
 * Blocked:
 * - Vercel Preview (or any non-production deploy) against Production Supabase
 * - Explicit MERCHANT_MUTATIONS_DISABLED=1
 * - Unknown/missing Supabase URL
 */
export function evaluateMerchantWritePolicy(
  env: NodeJS.ProcessEnv = process.env,
): MerchantWritePolicy {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const host = supabaseHost(url);
  const vercelEnv = env.VERCEL_ENV; // production | preview | development
  const isLocalSupabase = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
  const isProductionSupabase =
    url.includes(PRODUCTION_SUPABASE_REF) || host.includes(PRODUCTION_SUPABASE_REF);

  if (!url) {
    return {
      allowed: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not configured",
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  if (env.MERCHANT_MUTATIONS_DISABLED === "1") {
    return {
      allowed: false,
      reason: "MERCHANT_MUTATIONS_DISABLED=1",
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  if (isLocalSupabase) {
    return {
      allowed: true,
      reason: "local_supabase",
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  // Preview / branch deploys must never mutate Production data
  if (isProductionSupabase && vercelEnv && vercelEnv !== "production") {
    return {
      allowed: false,
      reason: `Blocked: Vercel env "${vercelEnv}" cannot mutate Production Supabase (${PRODUCTION_SUPABASE_REF})`,
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  // Heuristic: Preview URLs without VERCEL_ENV set still block Production writes
  if (isProductionSupabase && env.VERCEL === "1" && vercelEnv !== "production") {
    return {
      allowed: false,
      reason: "Blocked: non-production Vercel deployment against Production Supabase",
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  if (isProductionSupabase && vercelEnv === "production") {
    return {
      allowed: true,
      reason: "vercel_production",
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  // Non-local, non-production-ref (future staging): allow if explicitly opted in
  if (env.MERCHANT_WRITES_ALLOW_REMOTE === "1") {
    return {
      allowed: true,
      reason: "MERCHANT_WRITES_ALLOW_REMOTE=1",
      supabaseHost: host,
      vercelEnv,
      isLocalSupabase,
      isProductionSupabase,
    };
  }

  // Default fail-closed for unknown remote targets
  return {
    allowed: false,
    reason: "Blocked: remote Supabase writes require Production deploy or MERCHANT_WRITES_ALLOW_REMOTE=1",
    supabaseHost: host,
    vercelEnv,
    isLocalSupabase,
    isProductionSupabase,
  };
}

export function canPersistMerchantSideEffects(env?: NodeJS.ProcessEnv): boolean {
  return evaluateMerchantWritePolicy(env).allowed;
}

/** Throws MerchantWriteBlockedError (403) when merchant mutations are not permitted. */
export function assertMerchantMutationAllowed(operation = "merchant_mutation"): void {
  const policy = evaluateMerchantWritePolicy();
  if (policy.allowed) return;
  throw new MerchantWriteBlockedError(
    `${operation} refused: ${policy.reason}. Use local Supabase or an isolated staging database for mutating Preview tests.`,
  );
}
