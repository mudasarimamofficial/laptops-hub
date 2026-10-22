import { defineConfig } from "@playwright/test";
import path from "path";
import os from "os";

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
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "off",
    // SSO-protected Vercel previews: a storage state captured after opening a share link.
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH || localChromium,
    },
  },
  reporter: [["list"], ["json", { outputFile: "docs/visual-evidence/playwright-results.json" }]],
});

