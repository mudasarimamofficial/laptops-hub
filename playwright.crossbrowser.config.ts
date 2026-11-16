import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";
import base from "./playwright.config";

try {
  const envPath = path.resolve(".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch {}

/**
 * Cross-browser run against the ISOLATED stack only (local Supabase + `next start -p 3001`).
 *   npx playwright test -c playwright.crossbrowser.config.ts
 * Chromium desktop + Android-sized Chromium, WebKit desktop + iPhone-sized WebKit, Firefox desktop.
 */
const chromePath = base.use?.launchOptions?.executablePath;
export default defineConfig({
  testDir: "tests/e2e-isolated",
  testMatch: ["cross-browser-storefront.spec.ts", "launch-journey.spec.ts"],
  timeout: 180_000, // six widths per page, first project runs on cold caches
  retries: 0,
  workers: 1,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001", trace: "off" },
  reporter: [["list"], ["json", { outputFile: "docs/evidence/cross-browser/results.json" }]],
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: chromePath } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath: chromePath } } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 14"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
  ],
});
