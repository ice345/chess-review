import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The offline and Browser Core specs require the production standalone
  // artifact: the service worker is registered for production builds only, so
  // the dev server deliberately has none. They run in the release suite.
  testIgnore: ["**/r4-browser-core.spec.ts", "**/r5-*.spec.ts", "**/offline.spec.ts"],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Serial everywhere, matching CI. The platform guard buckets every client as
  // "shared" when PLATFORM_CLIENT_IP_HEADER is unset (it is unset locally, as
  // production sets x-real-ip), so requests accumulate against one 120/minute
  // budget for the whole run. Measured: a spec that loads pages repeatedly can
  // exhaust it and make an unrelated route spec see "Too many platform requests".
  // Specs stub the endpoints they do not assert; serial execution keeps the
  // remaining traffic predictable. Do not loosen the guard itself: that bound is
  // real product behaviour.
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  timeout: 45_000,
  expect: { timeout: 8_000, toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.015 } },
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev:web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
});
