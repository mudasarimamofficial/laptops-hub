import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Launch journeys against the isolated stack (docs/ISOLATED_TESTS.md). Never point this at production. */
export default defineConfig({
  ...base,
  testDir: "tests/e2e-isolated",
  workers: 1,
  timeout: 90_000,
  use: { ...base.use, baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001", storageState: undefined },
  reporter: [["list"], ["json", { outputFile: "test-results/isolated-journeys.json" }]],
});
