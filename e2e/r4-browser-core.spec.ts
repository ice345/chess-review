import { expect, test } from "@playwright/test";
import { SHORT_ANALYSIS_PGN, seedReview } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // A public build must not even probe a visitor's local services.
  await page.route(/https?:\/\/(?:127\.0\.0\.1|localhost):(?:8000|11434)\//, (route) => route.abort());
});

test("fresh production visitor completes real Stockfish review and grounded study without local AI", async ({ page }) => {
  test.setTimeout(120_000);
  const localRequests: string[] = [];
  page.on("request", (request) => { if (/:(8000|11434)\//.test(request.url())) localRequests.push(request.url()); });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Browser Core", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check local runtime" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download model" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Depth", exact: true }).selectOption("10");
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(SHORT_ANALYSIS_PGN);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("link", { name: "Study", exact: true }).click();
  await page.getByRole("button", { name: "Build whole-game study" }).click();
  await expect(page.locator(".game-coach-result")).toContainText("Training recommendations");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await page.getByRole("button", { name: "Review e4 from facts", exact: true }).click();
  await expect(page.locator(".coach-result")).toBeVisible();
  await page.goto("/history");
  await expect(page.locator(".history-summary")).toContainText("1 Analyzed");
  expect(localRequests).toEqual([]);
});

test("public settings, study and metadata reflect only implemented capabilities", async ({ page, request }, info) => {
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}/coach`);
  await expect(page.getByRole("button", { name: "Build whole-game study", exact: true })).toBeVisible();
  await expect(page.getByText("A summary can still be built from this game's own analysis.")).toBeVisible();
  await expect(page.locator(".service-message")).toContainText("not provided by this website");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await page.goto("/settings");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`browser-settings-${width}.png`), fullPage: true });
  }
  await page.goto("/help");
  await expect(page).toHaveTitle("Help and data privacy · Open Chess Review");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /api/");
});
