import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.browser-core.config";

export default defineConfig({
  ...base,
  testMatch: ["**/r4-browser-core.spec.ts", "**/r5-release.spec.ts", "**/r3.spec.ts", "**/s1-notebook.spec.ts", "**/mistake-practice.spec.ts"],
  timeout: 90_000,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
