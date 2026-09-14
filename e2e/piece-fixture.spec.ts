import { expect, test } from "@playwright/test";
import { PIECE_ASSET_DIR } from "../apps/web/src/lib/board-piece-assets";

/* Feather Porcelain v1.1 acceptance.
 *
 * The fixture page proves two different things, and both are asserted here:
 * - rendering: every authored asset decodes on both square colors at every size;
 * - recognition: King, Queen and Bishop stay identifiable without the starting
 *   position and from silhouette alone.
 *
 * The live assertions cover the served path. `/pieces/` is cache-first in the
 * service worker, which is why the art directory is versioned; a released
 * visitor must therefore load the current directory, never the previous one. */

test("the piece fixture renders every recognition pass", async ({ page }) => {
  await page.goto("/design/pieces");

  // 12 roles × matrix (10) + silhouette (2) + distance (5) + Classic compare (10).
  await expect(page.locator(".quality-fixture-grid > section")).toHaveCount(6);
  await expect(page.locator(".piece-fixture-row")).toHaveCount(48);
  await expect(page.locator(".piece-fixture-cell")).toHaveCount(324);
  const sizes = await page.locator(".piece-fixture-cell").evaluateAll((cells) => [...new Set(cells.map((cell) => (cell as HTMLElement).dataset.size))].sort());
  expect(sizes).toEqual(["32", "40", "48", "56", "72"]);

  // Every rendered piece is decoded, so a missing or corrupt asset cannot pass.
  const undecoded = await page.evaluate(() => [...document.querySelectorAll(".piece-fixture-cell img")]
    .filter((image) => (image as HTMLImageElement).naturalWidth === 0)
    .map((image) => image.getAttribute("src")));
  expect(undecoded).toEqual([]);

  // Recognition layer: an unlabelled position with the roles behind a reveal.
  const blind = page.locator(".piece-fixture-boards").first().locator(".piece-fixture-board").first();
  await expect(blind.locator(".board-wrap img, .piece-fixture-board-wrap img")).toHaveCount(6);
  const reveal = blind.locator("details");
  await expect(reveal.locator("ul")).toBeHidden();
  await reveal.locator("summary").click();
  await expect(reveal.locator("ul li")).toHaveCount(6);
  await expect(reveal).toContainText("h6 black King");

  // Silhouette and blur must be real filters, not a styling intention.
  await expect(page.locator(".piece-fixture-cell.silhouette .piece-fixture-figure").first())
    .toHaveCSS("filter", "brightness(0) saturate(0)");
  await expect(page.locator(".piece-fixture-cell.blur .piece-fixture-figure").first())
    .toHaveCSS("filter", "blur(1px)");
  await expect(page.locator(".piece-fixture-silhouette img").first())
    .toHaveCSS("filter", "brightness(0) saturate(0)");

  // Classic comparison puts the same role at the same size side by side.
  const compare = page.locator(".piece-fixture-row").filter({ has: page.locator(".piece-fixture-divider") }).first();
  await expect(compare.locator(".piece-fixture-cell")).toHaveCount(10);
});

test("the live board and the promotion chooser load the versioned assets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "FEN" }).click();
  await page.getByLabel("Paste an explicit FEN").fill("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Open Engine Lab →" }).click();
  await expect(page).toHaveURL(/\/engine$/);

  await expect(page.locator(".board-wrap img").first()).toBeVisible();
  const boardSources = await page.locator(".board-wrap img").evaluateAll((images) => images.map((image) => image.getAttribute("src") ?? ""));
  expect(boardSources.length).toBeGreaterThan(0);
  for (const source of boardSources) expect(source).toContain(`${PIECE_ASSET_DIR}/`);

  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  const chooser = page.getByRole("dialog", { name: "Choose promotion piece" });
  await expect(chooser.locator(".promotion-piece img")).toHaveCount(4);
  const promotionSources = await chooser.locator(".promotion-piece img").evaluateAll((images) => images.map((image) => image.getAttribute("src") ?? ""));
  // The promoted side is White, so the chooser must offer the four white pieces.
  expect(promotionSources).toEqual(["wQ", "wR", "wB", "wN"].map((key) => `${PIECE_ASSET_DIR}/${key}.png`));
});
