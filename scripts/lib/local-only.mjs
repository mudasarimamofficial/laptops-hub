/**
 * Fail-closed guard for every script/test that WRITES fixtures (users, memberships, orders, collections, settings).
 * There is deliberately no override: these suites run against a local Supabase only (docs/ISOLATED_TESTS.md).
 *
 * All must hold, otherwise the process exits with code 2 before any client is created:
 *  1. NEXT_PUBLIC_SUPABASE_URL is a loopback host (127.0.0.1, localhost, [::1]) — never *.supabase.co.
 *  2. Neither the URL nor any supplied key names a hosted project: a JWT key carrying a `ref` claim (hosted keys
 *     do; the local CLI's demo keys do not) is refused, and the production ref is refused anywhere.
 *  3. The endpoint itself is local: the hosted API gateway answers with an `sb-project-ref` header, the local stack
 *     does not. A request that fails or shows that header is refused (catches a localhost tunnel to production).
 */
export const PRODUCTION_REF = "xvmmjkrkgznnakcobmww";
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;

function jwtRef(key) {
  const part = String(key || "").split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")).ref ?? null;
  } catch {
    return null;
  }
}

/** Pure checks (1, 2). Returns a list of reasons; empty = local. */
export function localOnlyProblems(url, keys = []) {
  const problems = [];
  if (!LOOPBACK.test(url || "")) problems.push("NEXT_PUBLIC_SUPABASE_URL is not a local (loopback) Supabase");
  if (/supabase\.(co|com|in)/i.test(url || "") || (url || "").includes(PRODUCTION_REF)) problems.push("URL names a hosted project");
  for (const k of keys) {
    if (!k) continue;
    if (String(k).includes(PRODUCTION_REF)) problems.push("a key contains the production project ref");
    const ref = jwtRef(k);
    if (ref) problems.push(`a key belongs to hosted project "${ref}"`);
  }
  return problems;
}

/** Full guard (1–3). Call before creating any Supabase client. */
export async function assertLocalOnly(label, { url = process.env.NEXT_PUBLIC_SUPABASE_URL, keys } = {}) {
  keys ??= [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY];
  const problems = localOnlyProblems(url, keys);
  if (!problems.length) {
    try {
      const res = await fetch(`${String(url).replace(/\/+$/, "")}/rest/v1/`, {
        headers: { apikey: keys.find(Boolean) || "" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.headers.get("sb-project-ref")) problems.push(`endpoint is hosted project "${res.headers.get("sb-project-ref")}"`);
    } catch (e) {
      problems.push(`could not confirm the endpoint is local (${e instanceof Error ? e.message : "request failed"})`);
    }
  }
  if (problems.length) {
    console.error(`Refusing to run ${label}: this suite writes test data and runs against a LOCAL Supabase only.`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Start `supabase start` and pass the local URL/keys (docs/ISOLATED_TESTS.md). There is no override.");
    process.exit(2);
  }
}
