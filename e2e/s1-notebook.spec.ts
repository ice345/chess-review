import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockLocalAi, seedReview, writeStores } from "./fixtures";
import { buildReviewRecord } from "../apps/web/src/lib/review-library";
import type { LibraryBackupV2 } from "../apps/web/src/lib/library-backup-format";

const panel = (page: Page) => page.getByRole("region", { name: "Notebook", exact: true });
const saved = (page: Page) => page.getByRole("region", { name: "Saved notebook entries" });
async function enter(page: Page) {
  await mockLocalAi(page, "offline");
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}/notebook?ply=2`);
  await expect(page.locator(".move-status")).toContainText("2 / 21 ply");
  await expect(page.getByLabel("Your note")).toBeEnabled();
  return record;
}
async function saveNote(page: Page, text: string) {
  await page.getByLabel("Your note").fill(text);
  await panel(page).getByRole("button", { name: /Save (note and bookmark|line and note)/ }).click();
  await expect(panel(page).getByText("Saved in this browser. Library backup includes this entry.")).toBeVisible();
}

test("saves position notes, bookmarks and a legal line; preserves the deep-linked board across sections", async ({ page }) => {
  const record = await enter(page);
  await page.getByLabel("Entry title").fill("Develop calmly");
  await page.getByLabel("Bookmark this position", { exact: true }).check();
  await saveNote(page, "Watch the opponent’s reply.");
  await page.locator('.board-wrap [data-square="f1"]').click();
  await page.locator('.board-wrap [data-square="c4"]').click();
  await page.locator('.board-wrap [data-square="g8"]').click();
  await page.locator('.board-wrap [data-square="f6"]').click();
  await expect(page.locator(".move-status")).toContainText("Analysis variation");
  await page.getByRole("link", { name: "Engine", exact: true }).click();
  await page.getByRole("link", { name: "Save this position in Notebook" }).click();
  await expect(panel(page).locator(".notebook-line")).toContainText("2. Bc4 2… Nf6");
  await page.getByLabel("Entry title").fill("An alternative line");
  await saveNote(page, "A saved line, separate from the source game.");
  await page.reload();
  await expect(saved(page)).toContainText("Saved entries · 2");
  await saved(page).getByRole("button", { name: /An alternative line/ }).click();
  await expect(page.locator(".move-status")).toContainText("Nf6");
  await expect(page.getByLabel("Your note")).toHaveValue("A saved line, separate from the source game.");
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.locator(".move-status")).toContainText("Bc4");
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.locator(".move-status")).toContainText("2 / 21 ply");
  await expect(page.getByLabel("Your note")).toHaveValue("Watch the opponent’s reply.");
  await page.getByLabel("Bookmarks only").check();
  await expect(saved(page).locator("li")).toHaveCount(1);
  await page.goto(`/review/${record.id}/notebook`);
  await expect(saved(page).locator("li")).toHaveCount(2);
});

test("retains drafts across position and route navigation and handles same-entry conflicts between tabs", async ({ page, context }) => {
  const record = await enter(page);
  const other = await context.newPage();
  try {
    await mockLocalAi(other, "offline"); await other.goto(`/review/${record.id}/notebook?ply=2`);
    await expect(other.getByLabel("Your note")).toBeEnabled();
    await other.getByLabel("Your note").fill("My unsaved second-tab draft");
    await page.getByLabel("Your note").fill("Keep this draft across sections");
    await page.getByRole("link", { name: "Moves", exact: true }).click();
    await page.getByRole("link", { name: "Notebook", exact: true }).click();
    await expect(page.getByLabel("Your note")).toHaveValue("Keep this draft across sections");
    await saveNote(page, "The first saved edit");
    await panel(other).getByRole("button", { name: "Save note and bookmark" }).click();
    await expect(panel(other).getByRole("alert")).toContainText("changed in another tab");
    await expect(other.getByLabel("Your note")).toHaveValue("My unsaved second-tab draft");
    await other.getByRole("button", { name: "Discard draft and reload saved entry" }).click();
    await expect(other.getByLabel("Your note")).toHaveValue("The first saved edit");
    await page.getByLabel("Your note").fill("Draft at ply two");
    await page.getByRole("button", { name: "Next move" }).click();
    await page.getByLabel("Your note").fill("Draft at ply three");
    await page.getByText("Return to an unsaved draft", { exact: true }).click();
    await page.locator(".notebook-draft-notice").getByRole("button", { name: "After 1… e5", exact: true }).click();
    await expect(page.getByLabel("Your note")).toHaveValue("Draft at ply two");
  } finally { await other.close(); }
});

test("shows storage failures without losing the draft and recovers on retry", async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, { restoreNotebookStorage: () => { IDBObjectStore.prototype.put = original; } });
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === "review-notebooks") throw new DOMException("Notebook storage is full", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByLabel("Your note").fill("Keep this text after a failed save.");
  await panel(page).getByRole("button", { name: "Save note and bookmark" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("Notebook storage is full");
  await expect(page.getByLabel("Your note")).toHaveValue("Keep this text after a failed save.");
  await expect(saved(page).locator("li")).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { restoreNotebookStorage: () => void }).restoreNotebookStorage());
  await saveNote(page, "<img src=x onerror=alert(1)> is plain personal text.");
  await expect(saved(page).locator("img")).toHaveCount(0);
  await page.reload();
  await saved(page).getByRole("button").click();
  await expect(page.getByLabel("Your note")).toHaveValue("<img src=x onerror=alert(1)> is plain personal text.");
  await panel(page).getByRole("button", { name: "Remove saved entry" }).click();
  await expect(saved(page).locator("li")).toHaveCount(0);
});

test("includes FEN notes and lines in portable backup, then restores them in a fresh browser", async ({ page, browser }) => {
  await mockLocalAi(page, "offline");
  const record = await buildReviewRecord("fen", "7k/8/8/8/8/8/p7/7K b - - 0 50");
  await writeStores(page, { "review-records": [[record.id, record]] });
  await page.goto(`/review/${record.id}/notebook`);
  await expect(page.getByLabel("Your note")).toBeEnabled();
  await page.getByLabel("Entry title").fill("A quiet promotion study");
  await page.getByLabel("Bookmark this position", { exact: true }).check();
  await saveNote(page, "Remember to examine underpromotion.");
  await page.locator('.board-wrap [data-square="a2"]').click();
  await page.locator('.board-wrap [data-square="a1"]').click();
  await page.getByRole("dialog", { name: "Choose promotion piece" }).getByRole("button", { name: "Knight" }).click();
  await saveNote(page, "The knight line is saved without an engine verdict.");
  await page.goto("/settings");
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download library backup" }).click();
  const file = await readFile((await (await pending).path())!);
  const backup = JSON.parse(file.toString()) as LibraryBackupV2;
  expect(backup.version).toBe(2); expect(backup.notebooks[0]!.entries).toHaveLength(2);
  expect(backup.notebooks[0]!.entries[1]!.line).toEqual(["a2a1n"]);
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const target = await context.newPage(); await mockLocalAi(target, "offline"); await target.goto("/settings");
    await target.getByLabel("Choose library backup").setInputFiles({ name: "notebook.json", mimeType: "application/json", buffer: file });
    await expect(target.getByRole("region", { name: "Backup restore preview" })).toContainText("Notebooks");
    await target.getByRole("button", { name: "Restore this backup" }).click();
    await expect(target.getByText("Library restored. Reload to continue with your games and saved progress.", { exact: true })).toBeVisible();
    await target.goto(`/review/${record.id}/notebook`);
    await expect(saved(target).locator("li")).toHaveCount(2);
    await saved(target).getByRole("button", { name: /50… a1=N/ }).click();
    await expect(target.locator(".move-status")).toContainText("a1=N");
    await expect(target.getByLabel("Your note")).toHaveValue("The knight line is saved without an engine verdict.");
  } finally { await context.close(); }
});

test("keeps notebook controls readable with a keyboard and at narrow widths", async ({ page }, info) => {
  await enter(page);
  await page.getByLabel("Your note").fill("A long note ".repeat(50));
  await page.getByLabel("Your note").press("ArrowLeft");
  await expect(page.locator(".move-status")).toContainText("2 / 21 ply");
  await saveNote(page, "Readable personal notes.");
  for (const [width, height] of [[1280, 720], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await expect(panel(page).getByRole("button", { name: "Save note and bookmark" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await panel(page).getByRole("button", { name: "Save note and bookmark" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (width === 1280) {
      const transport = (await page.locator(".move-transport").boundingBox())!;
      expect(transport.y + transport.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: info.outputPath(`notebook-${width}.png`), fullPage: true });
  }
});

test("reports PNG encoding failures and allows a successful retry", async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    Object.assign(window, { restorePngEncoding: () => { HTMLCanvasElement.prototype.toBlob = original; } });
    HTMLCanvasElement.prototype.toBlob = function (callback) { callback(null); };
  });
  await page.getByText("Export", { exact: true }).click();
  await page.getByRole("button", { name: "Position PNG", exact: true }).click();
  await expect(page.locator(".review-export-error")).toContainText("PNG encoding failed");
  await expect(page.getByRole("button", { name: "Position PNG", exact: true })).toBeEnabled();
  await page.evaluate(() => (window as unknown as { restorePngEncoding: () => void }).restorePngEncoding());
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Position PNG", exact: true }).click();
  expect((await pending).suggestedFilename()).toMatch(/\.png$/);
  await expect(page.locator(".review-export-error")).toHaveCount(0);
});
