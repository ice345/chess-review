import { expect, test } from "@playwright/test";
import { seedReview, seedUnanalyzedReview } from "./fixtures";

test("saved and cancelled imports are not counted as analyzed games", async ({ page }) => {
  const record = await seedUnanalyzedReview(page);
  await page.goto("/history");
  await expect(page.locator(".history-summary")).toContainText("0 Analyzed");
  await expect(page.locator(".history-list")).toContainText("Saved · not analyzed");
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Analyze game", exact: true })).toBeVisible();
  await page.goto("/history");
  await expect(page.locator(".history-summary")).toContainText("0 Analyzed");
  await expect(page.locator(".history-list")).toContainText("Cancelled");
});

test("FEN studies never count as completed game reviews", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "FEN", exact: true }).click();
  await page.getByRole("button", { name: "Use starting position" }).click();
  await page.getByRole("button", { name: "Open Engine Lab →" }).click();
  await expect(page).toHaveURL(/\/review\/.+\/engine$/);
  await page.goto("/history");
  await expect(page.locator(".history-list")).toContainText("Position study");
  await expect(page.locator(".history-summary")).toContainText("0 Analyzed");
  await expect(page.locator(".history-summary")).toContainText("0 Pending");
});

test("cache cleanup keeps the game but removes analyzed status after reload", async ({ page }) => {
  await seedReview(page);
  await page.goto("/history");
  await expect(page.locator(".history-summary")).toContainText("1 Analyzed");
  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear analysis cache" }).click();
  await expect(page.getByRole("button", { name: "Clear analysis cache" })).toBeEnabled();
  await page.goto("/history");
  await expect(page.locator(".history-summary")).toContainText("0 Analyzed");
  await expect(page.locator(".history-list")).toContainText("Ada vs Mikhail");
});

test("a storage failure is recoverable and is never shown as an empty library", async ({ page }) => {
  await seedReview(page);
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    Object.assign(window, { restoreTestStorage: () => { indexedDB.open = open; } });
    indexedDB.open = () => { throw new DOMException("Local storage is temporarily unavailable.", "UnknownError"); };
  });
  await page.goto("/history");
  const storageError = page.getByRole("alert").filter({ hasText: "Local storage is temporarily unavailable" });
  await expect(storageError).toBeVisible();
  await expect(page.getByText("No saved games yet")).toHaveCount(0);
  await expect(page.getByText("No matching games")).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { restoreTestStorage: () => void }).restoreTestStorage());
  await page.getByRole("button", { name: "Retry loading games" }).click();
  await expect(page.locator(".history-list")).toContainText("Ada vs Mikhail");
  await expect(storageError).toHaveCount(0);
});

test("cleanup in another tab requests reload instead of allowing stale data to be saved", async ({ page, context }) => {
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible();
  const settings = await context.newPage();
  await settings.goto("/settings");
  settings.once("dialog", (dialog) => dialog.accept());
  await settings.getByRole("button", { name: "Reset all local data" }).click();
  await expect(settings).toHaveURL(/\/$/);
  await expect(page.getByRole("alert").filter({ hasText: "Local data changed" })).toBeVisible();
  await page.getByRole("button", { name: "Reload page" }).click();
  await expect(page.getByText("Review not found", { exact: true })).toBeVisible();
  await settings.close();
});

test("a failed delete keeps the review visible and can be retried", async ({ page }) => {
  await seedReview(page);
  await page.goto("/history");
  await expect(page.locator(".history-list")).toContainText("Ada vs Mikhail");
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    Object.assign(window, { restoreTestWrites: () => { IDBDatabase.prototype.transaction = transaction; } });
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === "readwrite") throw new DOMException("Local storage writes are unavailable.", "QuotaExceededError");
      return transaction.apply(this, args);
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Local storage writes are unavailable" })).toBeVisible();
  await expect(page.locator(".history-list")).toContainText("Ada vs Mikhail");
  await page.evaluate(() => (window as unknown as { restoreTestWrites: () => void }).restoreTestWrites());
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No saved games yet", { exact: true })).toBeVisible();
});

test("malformed public sync input gets a user error response", async ({ request }) => {
  const response = await request.post("/api/platforms/chesscom/sync", { data: { account: { provider: "chesscom", username: 42 } } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toHaveProperty("error");
});
