import { expect, test } from "@playwright/test";
import { mockLocalAi, seedReview } from "./fixtures";

test("local capability setup distinguishes missing models and never downloads on selection", async ({ page }) => {
  const { requests } = await mockLocalAi(page);
  let downloads = 0;
  page.on("request", (request) => { if (request.url().endsWith("/download")) downloads++; });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Local enhancements" })).toBeVisible();
  await page.getByRole("combobox", { name: "Maia model", exact: true }).selectOption("maia3-79m");
  await expect(page.getByRole("button", { name: "Download model", exact: true })).toBeVisible();
  await expect(page.locator(".human-model-status")).toContainText("not-cached");
  await page.getByRole("combobox", { name: "Provider", exact: true }).selectOption("openai-compatible");
  await expect(page.getByRole("status").filter({ hasText: "Cloud explanations" })).toContainText("headers and player names");
  expect(downloads).toBe(0); expect(requests).toHaveLength(0);
});

test("output language is independent of interface language and offline facts stay usable", async ({ page }) => {
  await mockLocalAi(page, "offline");
  const { record } = await seedReview(page);
  await page.goto("/settings");
  await expect(page.getByLabel("Coach output language")).toHaveValue("en");
  await page.getByLabel("Coach output language").selectOption("zh-CN");
  await page.goto(`/review/${record.id}/coach?ply=1`);
  await page.getByRole("button", { name: "Explain e4", exact: true }).click();
  await expect(page.locator(".coach-result")).toContainText("先看什么");
  await expect(page.getByRole("button", { name: "Build whole-game study", exact: true })).toBeVisible();
  await expect(page.locator(".coach-configuration-summary")).toContainText("简体中文");
  await page.reload();
  await expect(page.locator(".coach-result")).toContainText("先看什么");
});

test("help explains storage, public identity and optional services at narrow widths", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Help, capabilities and data privacy/ }).click();
  await expect(page.getByRole("heading", { name: "Help and data privacy" })).toBeVisible();
  await expect(page.locator("#your-data")).toContainText("does not verify account ownership");
  await expect(page.locator("#your-data")).toContainText("encrypted HttpOnly cookie");
  await expect(page.getByRole("link", { name: "Open a bug report" })).toHaveAttribute("href", /github\.com\/ice345\/chess-review\/issues\/new\?template=bug_report.yml/);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`help-${width}.png`), fullPage: true });
  }
});

test("public routes reject foreign mutations and serve private metadata without caching", async ({ request }) => {
  const rejected = await request.delete("/api/platforms/lichess/session", { headers: { origin: "https://foreign.example", "sec-fetch-site": "cross-site" } });
  expect(rejected.status()).toBe(403);
  const session = await request.get("/api/platforms/lichess/session");
  expect(await session.json()).toMatchObject({ connected: false });
  expect(session.headers()["cache-control"]).toContain("no-store");
  expect(session.headers()["referrer-policy"]).toBe("no-referrer");
  const help = await request.get("/help");
  expect(help.headers()["x-content-type-options"]).toBe("nosniff");
});
