/** Production Supabase project ref — must never be mutated from Preview. */
export const PRODUCTION_SUPABASE_REF = "xvmmjkrkgznnakcobmww";

const LOOPBACK_URL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i;

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
  problems: string[];
};

function supabaseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Decode JWT payload `ref` (hosted Supabase keys carry one; local CLI demo keys usually do not). */
export function jwtProjectRef(key: string | undefined | null): string | null {
  if (!key) return null;
  const part = String(key).split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { ref?: string };
    return json.ref ?? null;
  } catch {
    return null;
  }
}

/**
 * Pure identity checks (ported from scripts/lib/local-only.mjs).
 * Empty array = URL+keys look like genuine local CLI Supabase.
 */
export function localOnlyIdentityProblems(
  url: string,
  keys: Array<string | undefined | null> = [],
): string[] {
  const problems: string[] = [];
  if (!LOOPBACK_URL.test(url || "")) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is not a local (loopback) Supabase");
  }
  if (/supabase\.(co|com|in)/i.test(url || "") || (url || "").includes(PRODUCTION_SUPABASE_REF)) {
    problems.push("URL names a hosted project");
  }
  for (const k of keys) {
    if (!k) continue;
    if (String(k).includes(PRODUCTION_SUPABASE_REF)) {
      problems.push("a key contains the production project ref");
    }
    const ref = jwtProjectRef(k);
    if (ref) problems.push(`a key belongs to hosted project "${ref}"`);
  }
  return problems;
}

function collectKeys(env: NodeJS.ProcessEnv): string[] {
  return [
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    env.SUPABASE_ANON_KEY,
  ].filter((k): k is string => !!k);
}

/**
 * Synchronous fail-closed policy for merchant DB mutations.
 *
 * Local writes require loopback URL AND keys that do not identify a hosted project
 * (blocks localhost tunnels that forward Production credentials).
 *
 * Production writes require Vercel production + Production project URL.
 */
export function evaluateMerchantWritePolicy(
  env: NodeJS.ProcessEnv = process.env,
): MerchantWritePolicy {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const host = supabaseHost(url);
  const vercelEnv = env.VERCEL_ENV;
  const keys = collectKeys(env);
  const isLoopbackHost = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
  const isProductionSupabase =
    url.includes(PRODUCTION_SUPABASE_REF) || host.includes(PRODUCTION_SUPABASE_REF);
  const localProblems = isLoopbackHost ? localOnlyIdentityProblems(url, keys) : [];
  const isLocalSupabase = isLoopbackHost && localProblems.length === 0;

  const base = {
    supabaseHost: host,
    vercelEnv,
    isLocalSupabase,
    isProductionSupabase,
  };

  if (!url) {
    return {
      ...base,
      allowed: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not configured",
      problems: ["missing_url"],
    };
  }

  if (env.MERCHANT_MUTATIONS_DISABLED === "1") {
    return {
      ...base,
      allowed: false,
      reason: "MERCHANT_MUTATIONS_DISABLED=1",
      problems: ["explicit_disable"],
    };
  }

  // Loopback URL with hosted keys / production ref → treat as tunnel, refuse
  if (isLoopbackHost && localProblems.length) {
    return {
      ...base,
      allowed: false,
      reason: `Blocked: local URL failed identity checks (${localProblems.join("; ")})`,
      problems: localProblems,
    };
  }

  if (isLocalSupabase) {
    return {
      ...base,
      allowed: true,
      reason: "local_supabase_verified",
      problems: [],
    };
  }

  if (isProductionSupabase && vercelEnv && vercelEnv !== "production") {
    return {
      ...base,
      allowed: false,
      reason: `Blocked: Vercel env "${vercelEnv}" cannot mutate Production Supabase (${PRODUCTION_SUPABASE_REF})`,
      problems: ["preview_production"],
    };
  }

  if (isProductionSupabase && env.VERCEL === "1" && vercelEnv !== "production") {
    return {
      ...base,
      allowed: false,
      reason: "Blocked: non-production Vercel deployment against Production Supabase",
      problems: ["preview_production"],
    };
  }

  if (isProductionSupabase && vercelEnv === "production") {
    return {
      ...base,
      allowed: true,
      reason: "vercel_production",
      problems: [],
    };
  }

  // Explicit isolated staging (never Production ref)
  if (env.MERCHANT_WRITES_ALLOW_REMOTE === "1" && !isProductionSupabase) {
    return {
      ...base,
      allowed: true,
      reason: "MERCHANT_WRITES_ALLOW_REMOTE=1",
      problems: [],
    };
  }

  if (env.MERCHANT_WRITES_ALLOW_REMOTE === "1" && isProductionSupabase) {
    return {
      ...base,
      allowed: false,
      reason: "MERCHANT_WRITES_ALLOW_REMOTE cannot target Production Supabase",
      problems: ["staging_is_production"],
    };
  }

  return {
    ...base,
    allowed: false,
    reason:
      "Blocked: remote Supabase writes require Production deploy or MERCHANT_WRITES_ALLOW_REMOTE=1 on an isolated project",
    problems: ["unknown_remote"],
  };
}

export function canPersistMerchantSideEffects(env?: NodeJS.ProcessEnv): boolean {
  return evaluateMerchantWritePolicy(env).allowed;
}

/** Throws when merchant mutations are not permitted (sync checks). */
export function assertMerchantMutationAllowed(operation = "merchant_mutation"): void {
  const policy = evaluateMerchantWritePolicy();
  if (policy.allowed) return;
  throw new MerchantWriteBlockedError(
    `${operation} refused: ${policy.reason}. Use a verified local Supabase or an isolated staging database for mutating Preview tests.`,
  );
}

/**
 * Async hardening: when policy claims local Supabase, probe the REST endpoint.
 * Hosted gateways answer with `sb-project-ref` — refuse (localhost tunnel).
 * Unreachable endpoints also refuse (fail-closed).
 */
export async function assertMerchantMutationAllowedAsync(
  operation = "merchant_mutation",
  env: NodeJS.ProcessEnv = process.env,
): Promise<MerchantWritePolicy> {
  const policy = evaluateMerchantWritePolicy(env);
  if (!policy.allowed) {
    throw new MerchantWriteBlockedError(
      `${operation} refused: ${policy.reason}. Use a verified local Supabase or an isolated staging database.`,
    );
  }

  if (policy.reason === "local_supabase_verified") {
    const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
    const apikey =
      env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      const hostedRef = res.headers.get("sb-project-ref");
      if (hostedRef) {
        throw new MerchantWriteBlockedError(
          `${operation} refused: loopback URL terminates at hosted project "${hostedRef}" (tunnel).`,
        );
      }
    } catch (e) {
      if (e instanceof MerchantWriteBlockedError) throw e;
      throw new MerchantWriteBlockedError(
        `${operation} refused: could not confirm local Supabase endpoint (${e instanceof Error ? e.message : "request failed"}).`,
      );
    }
  }

  return policy;
}
