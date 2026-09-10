import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockLocalAi, seedReview } from "./fixtures";

const PGN = '\r\n[White "Ada"]\n[Black "Mikhail"]\n\n1. e4 {keep this comment} e5 $1 (1... c5) 2. Nf3 *\r\n';
const OTHER = '[White "Mei"]\n[Black "Yuki"]\n\n1. d4 d5 *';

test("PGN file import preserves original comments, NAGs and variations on download", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose PGN file").setInputFiles({ name: "notes.pgn", mimeType: "application/x-chess-pgn", buffer: Buffer.from(PGN) });
  await expect(page.getByLabel("Paste a complete PGN")).toHaveValue(PGN.replaceAll("\r\n", "\n"));
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9]+$/);
  await page.getByText("Export", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Original PGN", exact: true }).click();
  const download = await pending;
  expect(await readFile((await download.path())!, "utf8")).toBe(PGN);
  await expect(page.locator(".export-note")).toContainText("Annotated adds analysis to the mainline");
});

test("multi-game files require an explicit selection and import only that game", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose PGN file").setInputFiles({ name: "games.pgn", mimeType: "application/x-chess-pgn", buffer: Buffer.from(PGN + OTHER) });
  await expect(page.getByRole("status").filter({ hasText: "2 games" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze game →" })).toBeDisabled();
  await page.getByLabel("Choose a game", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9]+$/);
  await expect(page.locator(".review-titlebar")).toContainText("Mei vs Yuki");
  await page.goto("/history");
  await expect(page.locator(".history-list > article")).toHaveCount(1);
});

test("pasted collections use the same game chooser", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Paste a complete PGN").fill(PGN + OTHER);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page.getByLabel("Choose a game", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("file drops work and a rejected file does not overwrite the current PGN", async ({ page }) => {
  await page.goto("/");
  const transfer = await page.evaluateHandle((pgn) => {
    const data = new DataTransfer();
    data.items.add(new File([pgn], "dropped.pgn", { type: "application/x-chess-pgn" }));
    return data;
  }, OTHER);
  await page.locator(".import-card").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByLabel("Paste a complete PGN")).toHaveValue(OTHER);
  await page.getByLabel("Choose PGN file").setInputFiles({ name: "image.png", mimeType: "image/png", buffer: Buffer.from("bad") });
  await expect(page.getByRole("alert").filter({ hasText: "Choose a .pgn file" })).toBeVisible();
  await expect(page.getByLabel("Paste a complete PGN")).toHaveValue(OTHER);
});

test("the complete example gets real Stockfish evidence and a working learning entry", async ({ page }) => {
  test.setTimeout(90_000);
  await mockLocalAi(page, "offline");
  await page.goto("/");
  await page.getByRole("button", { name: "Load example game" }).click();
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole("region", { name: "Review next step" })).toContainText("Start with a key moment");
  const study = await page.getByRole("link", { name: "Study this move →", exact: true }).getAttribute("href");
  expect(study).toMatch(/\/coach\?ply=\d+$/);
  await page.getByRole("button", { name: "Review key moment →" }).click();
  await expect(page.locator(".dual-verdict")).toBeVisible();
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.locator(".move-status")).toContainText("33 / 33 ply");
  await expect(page.getByText("Checkmate · no legal continuation.", { exact: true })).toBeVisible();
  await page.goto(study!);
  await expect(page.locator(".coach-move-facts")).toBeVisible();
});

test("temporary variations are labelled and returning preserves the original game", async ({ page }) => {
  await mockLocalAi(page, "offline");
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await page.locator('.board-wrap [data-square="d2"]').click();
  await page.locator('.board-wrap [data-square="d4"]').click();
  await expect(page.locator(".branch-session-note")).toContainText("Temporary variation · not saved");
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.locator(".branch-session-note")).toHaveCount(0);
  await expect(page.locator(".move-status")).toContainText("0 / 21 ply");
});

test("keyboard import focus and 200% text remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "PGN", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "FEN", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Open PGN file" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Paste a complete PGN")).toBeFocused();
  // Enlarge rendered text, including CSS pixel-sized copy. Width also models
  // a 1440px desktop reflowing at 200% browser zoom.
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}/moves`);
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => !element.closest(".board-wrap"))
      .map((element) => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".move-status")).toContainText("1 / 21 ply");
});
