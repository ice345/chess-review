import { expect, test } from "@playwright/test";
import { SAMPLE_PGN, mockLocalAi, seedConnectedLibrary, seedReview } from "./fixtures";

test("imports a PGN from Home and enters the review workspace", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/");
  await page.getByRole("button", { name: "PGN", pressed: true }).click();
  await page.getByLabel("Paste a complete PGN").fill(SAMPLE_PGN);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9]{20}$/);
  await expect(page.getByText("Ada vs Mikhail", { exact: true })).toBeVisible();
});

test("opens the matching account controls from the Home source links", async ({ page }) => {
  await page.route("**/api/platforms/chesscom/link", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ account: {
      id: "chesscom:ada",
      provider: "chesscom",
      username: "ada",
      displayName: "Ada",
      authMode: "public-username",
      verified: false,
      linkedAt: "2026-08-24T00:00:00.000Z",
    } }),
  }));
  await page.goto("/");
  await page.getByRole("link", { name: "Connect Chess.com in Settings" }).click();
  await expect(page).toHaveURL(/\/settings#chesscom-link$/);
  await page.getByLabel("Chess.com username").fill("ada");
  await page.locator("#chesscom-link").getByRole("button", { name: "Link" }).click();
  await expect(page.getByRole("status")).toContainText("ada linked as a public, unverified Chess.com profile");

  await page.goto("/");
  await page.getByRole("link", { name: "Connect Lichess in Settings" }).click();
  await expect(page).toHaveURL(/\/settings#lichess-link$/);
  await expect(page.locator("#lichess-link").getByRole("button")).toBeVisible();
});

test("navigates, flips, explores a branch, and returns to canonical play", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1117 });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".move-status").getByText("1. e4", { exact: true })).toBeVisible();
  const evaluation = page.locator(".eval-bar");
  const beforeFlip = await evaluation.getAttribute("aria-label");
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(evaluation).not.toHaveAttribute("aria-label", beforeFlip ?? "");

  await page.getByRole("button", { name: "First position" }).click();
  await page.waitForTimeout(200);
  await page.locator('[data-square="d2"]').click();
  await expect(page.locator('[data-square="d4"] > div')).toHaveAttribute("style", /radial-gradient/);
  await page.locator('[data-square="d4"]').click();
  await expect(page.getByText(/Analysis branch · root ply 0/)).toBeVisible();
  await page.locator('[data-square="d7"]').click();
  await expect(page.locator('[data-square="d5"] > div')).toHaveAttribute("style", /radial-gradient/);
  await page.locator('[data-square="d5"]').click();
  await expect(page.getByText(/Analysis variation · d5/)).toBeVisible();
  await expect(page.locator('.continuation-list > button').first()).toBeVisible({ timeout: 30_000 });
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.getByText(/Analysis branch · root ply/)).toHaveCount(0);

  await page.getByRole("button", { name: "Go to ply 2, Best" }).click();
  await expect(page.locator(".move-status").getByText("1… e5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.getByText("21 / 21 ply", { exact: true })).toBeVisible();
});

test("shows deterministic offline and mocked Maia states without live services", async ({ page }) => {
  await mockLocalAi(page, "available");
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Maia" }).click();
  await expect(page.getByText("Stockfish and Maia recommend the same move")).toBeVisible();
  await expect(page.getByText(/model prediction, not objective quality/)).toBeVisible();
  await expect(page.getByText("NaN%", { exact: true })).toHaveCount(0);

  await page.unrouteAll({ behavior: "wait" });
  await mockLocalAi(page, "offline");
  await page.reload();
  await page.getByRole("button", { name: "Maia" }).click();
  await expect(page.getByText(/Local Maia service is offline/)).toBeVisible();
});

test("renders a large connected Library progressively", async ({ page }) => {
  await seedConnectedLibrary(page, 84);
  await page.goto("/history");
  await expect(page.locator(".history-game")).toHaveCount(60);
  await page.getByRole("button", { name: /Load 24 more/ }).click();
  await expect(page.locator(".history-game")).toHaveCount(84);
});
