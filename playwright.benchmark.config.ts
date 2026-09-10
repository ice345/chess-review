import { defineConfig } from "@playwright/test";
import base from "./playwright.browser-core.config";

export default defineConfig({
  ...base,
  testMatch: "**/r5-benchmark.spec.ts",
  timeout: 300_000,
  expect: { timeout: 240_000 },
  reporter: "line",
  // Baseline and optimized runs use the same production artifact and browser.
  outputDir: process.env.BENCHMARK_OUTPUT ?? "test-results/benchmark",
});
