import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seedAdvancedStudy, mockLocalAi, writeStores } from "./fixtures";
import { createTrainingQueueItem } from "../apps/web/src/lib/training-queue";
import { buildReviewRecord } from "../apps/web/src/lib/review-library";
import type { LibraryBackupV2 } from "../apps/web/src/lib/library-backup-format";

async function seedTask(page: Page) {
  await mockLocalAi(page, "offline");
  const games = await seedAdvancedStudy(page);
  const evidence = [games[0]!.analysis.moves[0]!, games[0]!.analysis.moves[2]!, games[1]!.analysis.moves[0]!].map((move, index) => ({ gameId: games[index === 2 ? 1 : 0]!.record.id, ply: move.ply, san: move.san, phase: move.phase, classification: move.classification, winPercentLoss: move.classificationReason.winPercentLoss }));
  const task = createTrainingQueueItem("manual:ada", { kind: "opening-decisions", gameCount: 2, incidentCount: 3, priority: 72, averageWinPercentLoss: 25, evidence });
  const fen = await buildReviewRecord("fen", games[0]!.record.initialFen);
  await writeStores(page, { "training-queue": [[task.id, task]], "review-records": [[fen.id, fen]] });
  await page.goto("/training");
  await expect(page.getByRole("region", { name: "Saved review tasks" })).toBeVisible();
  return { games, task, fen };
}
const session = (page: Page) => page.getByRole("region", { name: "Position review task" });
async function exportBackup(page: Page): Promise<Buffer> {
  await page.goto("/settings");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download library backup" }).click();
  return readFile((await (await downloaded).path())!);
}
async function chooseBackup(page: Page, buffer: Buffer) {
  await page.getByLabel("Choose library backup").setInputFiles({ name: "library.json", mimeType: "application/json", buffer });
}

test("reviews exact positions, pauses, continues across games and never counts revisits twice", async ({ page }) => {
  const { games } = await seedTask(page);
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(session(page)).toContainText("0 / 3 positions reviewed");
  await expect(page.locator(".move-status")).toContainText("1. e4");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(session(page).getByRole("button", { name: "Mark position reviewed" })).toBeDisabled();
  await session(page).getByRole("button", { name: "Return to task position" }).click();
  await session(page).getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(session(page)).toContainText("1 / 3 positions reviewed");
  await page.reload();
  await expect(session(page)).toContainText("1 / 3 positions reviewed");
  await expect(session(page).getByRole("button", { name: "Mark position reviewed" })).toHaveCount(0);
  await session(page).getByRole("link", { name: "Next position" }).click();
  await expect(page.locator(".move-status")).toContainText("2. Nf3");
  await page.getByRole("navigation", { name: "Review sections" }).getByRole("link", { name: "Study" }).click();
  expect(new URL(page.url()).searchParams.get("position")).toBe(`${games[0]!.record.id}:3`);
  await session(page).getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(session(page)).toContainText("2 / 3 positions reviewed");
  await session(page).getByRole("link", { name: "Pause and return" }).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.reload();
  await page.getByRole("button", { name: "Continue review" }).click();
  await expect(page).toHaveURL(new RegExp(`/review/${games[1]!.record.id}/moves`));
  await expect(page.locator(".move-status")).toContainText("1. e4");
  await session(page).getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(session(page)).toContainText("3 / 3 positions reviewed · Review complete");
  await session(page).getByRole("link", { name: "Back to Training" }).click();
  await page.getByRole("button", { name: "Revisit positions" }).click();
  await expect(session(page)).toContainText("3 / 3 positions reviewed");
});

test("restores backup into a fresh browser with progress, FEN and games but no caches or accounts", async ({ page, browser }) => {
  const { games, fen } = await seedTask(page);
  await page.getByRole("button", { name: "Start review" }).click();
  await session(page).getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(session(page)).toContainText("1 / 3 positions reviewed");
  const buffer = await exportBackup(page), file = JSON.parse(buffer.toString()) as LibraryBackupV2;
  expect(file.reviews).toHaveLength(4); expect(file.tasks[0]!.progress.reviewedPositionCount).toBe(1);
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin }); const target = await context.newPage();
  try {
    await mockLocalAi(target, "offline"); await target.goto("/settings");
    await chooseBackup(target, buffer);
    await expect(target.getByRole("region", { name: "Backup restore preview" })).toContainText("4");
    await target.getByRole("button", { name: "Restore this backup" }).click();
    await expect(target.getByText("Library restored. Reload to continue with your games and saved progress.", { exact: true })).toBeVisible();
    await target.getByRole("button", { name: "Reload and open Training" }).click();
    await expect(target.getByRole("region", { name: "Saved review tasks" })).toContainText("1 / 3 positions reviewed");
    await target.getByRole("button", { name: "Continue review" }).click();
    await expect(target).toHaveURL(new RegExp(`/review/${games[0]!.record.id}/moves`));
    await expect(session(target).getByRole("button", { name: "Mark position reviewed" })).toBeDisabled();
    await expect(session(target)).toContainText("Analyze this game");
    await target.goto(`/review/${fen.id}`); await expect(target.getByRole("link", { name: "Open Engine Lab" })).toBeVisible();
    const restored = await exportBackup(target);
    expect((JSON.parse(restored.toString()) as LibraryBackupV2).tasks[0]!.progress.reviewedPositionCount).toBe(1);
  } finally { await context.close(); }
});

test("previews conflicts, defaults to keeping progress, and rejects malformed files", async ({ page }) => {
  await seedTask(page); const buffer = await exportBackup(page);
  await page.goto("/training"); await page.getByRole("button", { name: "Start review" }).click();
  await session(page).getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(session(page)).toContainText("1 / 3 positions reviewed");
  await page.goto("/settings");
  await chooseBackup(page, Buffer.from("{"));
  await expect(page.locator(".library-backup").getByRole("alert")).toContainText("not a valid JSON backup");
  await expect(page.getByRole("button", { name: "Restore this backup" })).toHaveCount(0);
  await chooseBackup(page, buffer);
  await expect(page.getByText("1 differing items")).toBeVisible();
  await expect(page.getByLabel("When an ID already exists")).toHaveValue("keep-existing");
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await page.getByRole("button", { name: "Reload and open Training" }).click();
  await expect(page.getByRole("region", { name: "Saved review tasks" })).toContainText("1 / 3 positions reviewed");
});

test("rejects stale previews after another tab reviews a position and refreshes safely", async ({ page, context }) => {
  await seedTask(page); const buffer = await exportBackup(page);
  await chooseBackup(page, buffer);
  await expect(page.getByRole("button", { name: "Restore this backup" })).toBeVisible();
  const other = await context.newPage(); await mockLocalAi(other, "offline");
  await other.goto("/training"); await other.getByRole("button", { name: "Start review" }).click();
  await session(other).getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(session(other)).toContainText("1 / 3 positions reviewed");
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.locator(".library-backup").getByRole("alert")).toContainText("changed after the preview");
  await page.getByRole("button", { name: "Refresh preview" }).click();
  await expect(page.getByText("1 differing items")).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(other.getByRole("alert").filter({ hasText: "Local data changed" })).toContainText("Local data changed");
  await other.close();
});

test("blocked database upgrades recover after the other tab closes", async ({ page, context }) => {
  // Serve a blank page at the same origin so no app opens/upgrades the DB first.
  await page.route("**/r3-storage-fixture", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Storage fixture</title>" }));
  await page.goto("/r3-storage-fixture");
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.open("open-chess-review", 6);
    req.onupgradeneeded = () => req.result.createObjectStore("review-records");
    req.onsuccess = () => { (window as unknown as { heldDb: IDBDatabase }).heldDb = req.result; resolve(); };
  }));
  const other = await context.newPage(); await mockLocalAi(other, "offline"); await other.goto("/history");
  await expect(other.getByText("Close other Open Chess Review tabs", { exact: false }).first()).toBeVisible();
  await page.close(); await other.reload();
  await expect(other.getByRole("heading", { name: "Games and reviews" })).toBeVisible();
  await expect(other.getByRole("button", { name: "Retry local storage" })).toHaveCount(0);
  await other.close();
});

test("training and backup actions remain readable at desktop and narrow widths", async ({ page }, info) => {
  await seedTask(page);
  const buffer = await exportBackup(page);
  for (const [width, height] of [[1280,720],[390,844],[320,740]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/training"); await page.getByRole("button", { name: /Start review|Continue review/ }).click();
    await expect(session(page).getByRole("button", { name: "Mark position reviewed" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await session(page).getByRole("button", { name: "Mark position reviewed" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (width >= 1280) expect((await page.locator(".move-transport").boundingBox())!.y + (await page.locator(".move-transport").boundingBox())!.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: info.outputPath(`training-${width}.png`), fullPage: true });
    await page.goto("/settings"); await chooseBackup(page, buffer);
    await expect(page.getByRole("button", { name: "Restore this backup" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".library-backup").screenshot({ path: info.outputPath(`backup-${width}.png`) });
  }
});
