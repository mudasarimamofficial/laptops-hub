/**
 * Diagnostic LCP lab gate.
 * Preview + development + explicit ENABLE_LCP_LAB=1 only.
 * Never force-open on production.
 */
export function isLcpLabEnabled(): boolean {
  const env = process.env;
  if (env["ENABLE_LCP_LAB"] === "1") return true;
  if (env["VERCEL_ENV"] === "preview") return true;
  if (env["NODE_ENV"] === "development") return true;
  return false;
}
