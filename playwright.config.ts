import { defineConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import os from "os";

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

const localChromium = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "ms-playwright",
  "chromium-1248",
  "chrome-win64",
  "chrome.exe",
);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001",
    trace: "off",
    // SSO-protected Vercel previews: a storage state captured after opening a share link.
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH || localChromium,
    },
  },
  reporter: [["list"], ["json", { outputFile: "docs/visual-evidence/playwright-results.json" }]],
});

