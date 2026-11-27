import { defineConfig } from "@playwright/test";
import isolated from "./playwright.isolated.config";

/**
 * Same isolated stack, for Firefox and WebKit: `npx playwright test <spec> --config=playwright.isolated-xbrowser.config.ts
 * --browser=firefox` (or webkit). The base config pins a Chromium executable, which the other engines cannot use.
 */
export default defineConfig({
  ...isolated,
  use: { ...isolated.use, launchOptions: {} },
  reporter: [["list"]],
});
