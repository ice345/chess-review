import { expect, test } from "@playwright/test";
import { arrowCount, drawArrow, openReviewedGame } from "./arrow-helpers";

// Drawing an arrow is a right-click drag. Touch projects have no such gesture,
// so the check is scoped to pointer devices rather than faked there. Supporting
// touch drawing would need a dedicated gesture and is not implemented.
test.skip(({ isMobile }) => isMobile === true, "Touch devices have no right-click gesture for drawing arrows.");

test("a visitor can draw arrows without losing the engine arrows", async ({ page }) => {
  await openReviewedGame(page);

  const engineArrows = await arrowCount(page);
  console.log(JSON.stringify({ engineArrows }));
  expect(engineArrows).toBeGreaterThan(0);

  await drawArrow(page, "d2", "d4");
  const drawn = await arrowCount(page);
  console.log(JSON.stringify({ engineArrows, drawn }));
  expect(drawn).toBeGreaterThan(engineArrows);

  // An arrow describes one position, so moving on clears the drawing while the
  // engine candidates stay.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  const afterNavigation = await arrowCount(page);
  console.log(JSON.stringify({ afterNavigation }));
  expect(afterNavigation).toBe(engineArrows);
});
