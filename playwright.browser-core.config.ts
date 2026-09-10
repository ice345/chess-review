import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Run after a Browser Core production build; never reuse a development server. */
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/r4-browser-core.spec.ts",
  use: { ...base.use, baseURL: "http://localhost:3001" },
  workers: 1,
  webServer: {
    command: "node scripts/start-web-standalone.mjs 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
