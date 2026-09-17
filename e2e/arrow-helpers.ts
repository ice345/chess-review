import { expect, type Page } from "@playwright/test";

const PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *";

/** Arrows live in a dedicated 2048-unit overlay layer above the board. */
async function arrowCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const overlay = [...document.querySelectorAll(".board-wrap svg")]
      .find((svg) => svg.getAttribute("viewBox") === "0 0 2048 2048");
    return overlay ? overlay.querySelectorAll("path").length : -1;
  });
}

/** Practice marks the original mistake in pale red (`rgba(163, 78, 91, …)`). */
async function faultArrowCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const overlay = [...document.querySelectorAll(".board-wrap svg")]
      .find((svg) => svg.getAttribute("viewBox") === "0 0 2048 2048");
    if (!overlay) return -1;
    return [...overlay.querySelectorAll("path")].filter((path) => {
      const stroke = path.getAttribute("stroke") ?? getComputedStyle(path).stroke;
      return /163,\s*78,\s*91/.test(stroke);
    }).length;
  });
}

async function squareCenter(page: Page, square: string) {
  const box = await page.locator(`.board-wrap [data-square="${square}"]`).first().boundingBox();
  if (!box) throw new Error(`No square ${square}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function openReviewedGame(page: Page, pgn = PGN): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(pgn);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 120_000 });
}

export async function drawArrow(page: Page, from: string, to: string): Promise<void> {
  const start = await squareCenter(page, from);
  const end = await squareCenter(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2);
  await page.mouse.move(end.x, end.y);
  await page.mouse.up({ button: "right" });
}

export { arrowCount, faultArrowCount };
