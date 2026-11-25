/**
 * Same-site Origin header for direct API calls in isolated specs. Admin and checkout routes refuse cross-site requests
 * (403) before any other check, so a hard-coded port makes calls fail — or makes an expected 403 pass for the wrong
 * reason — whenever the isolated app runs on another port (PLAYWRIGHT_BASE_URL).
 */
export const ORIGIN = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001").origin;
