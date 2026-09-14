import { expect, test, type Page } from "@playwright/test";
import { seedReview, writeStores } from "./fixtures";

/* The three low-severity UI/UX audit findings, asserted as measurements rather
   than as intentions: F6 checkbox hit targets, F7 action-link hit areas, and F8
   the empty practice CTA. */

const MIN_ROW = 44;
const MIN_ACTION = 40;
const MAX_BOX = 24;

async function heights(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
}

async function expectAtLeast(page: Page, selector: string, minimum: number): Promise<void> {
  // Measure only after the element exists: a locator read does not auto-wait.
  await expect(page.locator(selector).first()).toBeVisible();
  const measured = await heights(page, selector);
  expect(measured.length, selector).toBeGreaterThan(0);
  for (const height of measured) expect(height, selector).toBeGreaterThanOrEqual(minimum);
}

test("F6: a checkbox row is the touch target while the box stays small", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings");
  await expectAtLeast(page, ".setting-row", MIN_ROW);
  await expect(page.locator(".setting-row input[type='checkbox']").first()).toBeVisible();
  const boxes = await heights(page, ".setting-row input[type='checkbox']");
  expect(boxes.length).toBeGreaterThanOrEqual(3);
  for (const height of boxes) expect(height).toBeLessThanOrEqual(MAX_BOX);

  // The same treatment elsewhere: the notebook toggle.
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}/notebook`);
  await expectAtLeast(page, ".notebook-bookmark", MIN_ROW);
});

test("F7: controls that act stay at least 40 px tall", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings");
  await expectAtLeast(page, ".settings-card .text-button, .utility-heading .text-button", MIN_ACTION);

  // Home's standalone actions, which are links rather than buttons.
  await seedReview(page);
  await page.goto("/");
  await expect(page.locator(".view-history")).toBeVisible();
  for (const selector of [".view-history", ".home-resume"]) {
    await expectAtLeast(page, selector, MIN_ACTION);
  }

  // Taller action rows must not cost the phone overflow contract.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/", "/history", "/settings"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}`).toBe(true);
    }
  }
});

test("F8: an empty practice set explains itself instead of leaving a dead CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await seedReview(page, { visualLabels: true });
  // Making every move ordinary removes the practice set, which is the empty state.
  fixture.analysis.moves.forEach((move) => { move.quality = "good"; move.annotations = []; });
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });

  const panel = page.locator(".retro-practice");
  await page.goto(`/review/${fixture.record.id}`);
  await expect(panel.locator(".utility-empty")).toContainText("No mistakes were recorded");
  await expect(panel.locator(".retro-idle-row > .primary")).toHaveCount(0);

  // With something to practise the action is back in the row, which is the state
  // the empty layout must not break.
  const ready = structuredClone(fixture.analysis);
  const fault = ready.moves[1]!;
  fault.quality = "mistake";
  fault.classificationReason = { ...fault.classificationReason, isBook: false };
  fault.stockfish = {
    fen: fault.fenBefore,
    depth: 12,
    score: { kind: "cp", cp: 22 },
    bestMove: "b8c6",
    lines: [{ rank: 1, depth: 12, score: { kind: "cp", cp: 22 }, pv: ["b8c6"] }],
  };
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, ready]] });
  await page.goto(`/review/${fixture.record.id}`);
  // The known side is White, which has nothing to practise; Black now has one.
  await page.getByRole("group", { name: "Which side to practise" }).getByRole("button", { name: "Black" }).click();
  const action = panel.locator(".retro-idle-row > .primary");
  await expect(action).toHaveCount(1);
  await expect(action).toBeEnabled();
});
