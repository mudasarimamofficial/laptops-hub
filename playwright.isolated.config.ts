import { defineConfig } from "@playwright/test";
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

/** Launch journeys against the isolated stack (docs/ISOLATED_TESTS.md). Never point this at production. */
export default defineConfig({
  ...base,
  testDir: "tests/e2e-isolated",
  workers: 1,
  timeout: 90_000,
  use: { ...base.use, baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001", storageState: undefined },
  reporter: [["list"], ["json", { outputFile: "test-results/isolated-journeys.json" }]],
});
