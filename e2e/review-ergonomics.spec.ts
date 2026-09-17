import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mockLocalAi, openReviewEngineLines, openReviewGameSummary, seedReview } from "./fixtures";
import { REVIEW_SHORTCUTS } from "../apps/web/src/lib/review-shortcuts";

/* Board ergonomics: keyboard shortcuts, the persisted desktop board size and
   Focus board. These are the interaction contracts of the review workspace, so
   they are asserted on the real board rather than through unit tests. */

async function openReview(page: Page) {
  const fixture = await seedReview(page);
  await page.goto(`/review/${fixture.record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".board-wrap img").first()).toBeVisible();
  return fixture;
}

async function boardWidth(page: Page): Promise<number> {
  const box = await page.locator(".board-wrap").boundingBox();
  if (!box) throw new Error("The board is not visible.");
  return Math.round(box.width);
}

/* The start of the game is its own state: nothing has been played, so the panel has
   one job. Everything that describes a *current* move is folded until the visitor
   asks for it, and the number beside a move is named once instead of per row. */
test("the start ply keeps one primary question and labels the move numbers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);

  const column = page.locator(".objective-route");
  await expect(page.locator(".move-status")).toContainText("Starting position");

  // One primary action only: the guided step when the game has key moments, the walk
  // through its moves when it has none. Practice and everything else stay secondary.
  await expect(column.locator(".primary, .primary-link")).toHaveCount(1);

  // The move table and the whole-game report are background until asked for.
  const nearby = column.locator("details.review-context-moves");
  await expect(nearby).not.toHaveAttribute("open", /.*/);
  await expect(nearby).toContainText("Moves, quality and accuracy");
  await expect(column.locator("details#game-summary")).not.toHaveAttribute("open", /.*/);

  // Opening it shows the same window it always did, now with a legend for the numbers.
  await nearby.locator("> summary").click();
  await expect(nearby).toHaveAttribute("open", /.*/);
  await expect(nearby.locator(".review-move-list button")).toHaveCount(6);
  await expect(nearby.locator(".move-list-legend")).toHaveText("Quality · Accuracy");
  await expect(nearby.locator(".review-move-list button").first()).toContainText("Accuracy 100");

  // Away from the start the nearby moves are the current ply's context, so they stay open.
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(column.locator("details.review-context-moves")).toHaveCount(0);
  await expect(column.locator("section.review-context-moves .review-move-list button")).toHaveCount(6);
});

test("drives the review from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  const status = page.locator(".move-status");

  await page.keyboard.press("ArrowRight");
  await expect(status).toContainText("1. e4");
  await page.keyboard.press("k");
  await expect(status).toContainText("1… e5");
  await page.keyboard.press("j");
  await expect(status).toContainText("1. e4");
  await page.keyboard.press("ArrowUp");
  await expect(status).toContainText("Starting position");
  await page.keyboard.press("ArrowDown");
  await expect(status).toContainText("21 / 21 ply");
  await page.keyboard.press("ArrowUp");

  // F flips the board. a1 must change sides of the board, not just its square color.
  const a1 = page.locator('[data-square="a1"]');
  const h1 = page.locator('[data-square="h1"]');
  expect((await a1.boundingBox())!.x).toBeLessThan((await h1.boundingBox())!.x);
  await page.keyboard.press("f");
  await expect.poll(async () => (await a1.boundingBox())!.x).toBeGreaterThan((await h1.boundingBox())!.x);
  await page.keyboard.press("f");
  await expect.poll(async () => (await a1.boundingBox())!.x).toBeLessThan((await h1.boundingBox())!.x);

  // Space plays and pauses, and the transport reports the state it is in.
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause playback" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play game" })).toBeVisible();
  await page.keyboard.press("ArrowUp");

  // `?` opens the shortcut list, and the workspace stops consuming keys until
  // the list closes, so navigation cannot happen behind the dialog.
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Shortcuts" });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Previous move");
  await expect(help).toContainText("Next move");
  await page.keyboard.press("ArrowRight");
  await expect(status).toContainText("Starting position");
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);

  // A control that owns the arrow keys keeps them: the board must not move.
  await page.locator(".board-controls > summary").click();
  const slider = page.getByRole("slider", { name: "Board size" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(status).toContainText("Starting position");
  await page.keyboard.press("Escape");

  // Escape also leaves a temporary variation, which is now part of the same map.
  await page.locator('[data-square="d2"]').click();
  await page.locator('[data-square="d4"]').click();
  await expect(page.getByText(/Analysis variation · d4/)).toBeVisible();
  // A new branch opens its engine lines, but only the menus that paint over the
  // board consume the first Escape; leaving the variation is one press.
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Analysis variation/)).toHaveCount(0);
});

test("keeps the desktop board size under the visitor's control", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openReview(page);
  const workspace = page.locator(".review-workspace");
  const automatic = await boardWidth(page);

  await page.locator(".board-controls > summary").click();
  const slider = page.getByRole("slider", { name: "Board size" });
  // The control reports what the layout granted, not what was requested: the
  // label carries the rendered width, while the range input can only hold a
  // multiple of its step (min 320 + k*20), so it holds the nearest one.
  await expect(page.locator(".board-size-row small")).toContainText(`Automatic · ${automatic} px`);
  expect(Math.abs(Number(await slider.inputValue()) - automatic)).toBeLessThanOrEqual(10);

  await slider.focus();
  await slider.press("ArrowRight");
  await slider.press("ArrowRight");
  await expect(workspace).toHaveAttribute("style", /--review-board-preference: \d+px/);
  await expect.poll(() => boardWidth(page)).toBeGreaterThan(automatic);
  const grown = await boardWidth(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The size survives a reload because it is a stored preference.
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect.poll(() => boardWidth(page)).toBe(grown);

  // Returning to the automatic size clears the preference for good.
  await page.locator(".board-controls > summary").click();
  await page.getByRole("button", { name: "Use the automatic size" }).click();
  await expect(workspace).not.toHaveAttribute("style", /--review-board-preference/);
  await expect.poll(() => boardWidth(page)).toBe(automatic);
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".review-workspace")).not.toHaveAttribute("style", /--review-board-preference/);
  expect(await boardWidth(page)).toBe(automatic);

  // Narrow layouts stay responsive and hide a control that could not apply.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".board-size-row")).toBeHidden();
  await expect(page.locator(".board-controls")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("board settings sit above move arrows and dismiss with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.locator(".board-controls > summary").click();
  const menu = page.locator(".board-controls-menu");
  await expect(menu).toBeVisible();
  const hitIsMenu = await menu.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return Boolean(hit && node.contains(hit));
  });
  expect(hitIsMenu, "chessboard arrows must not paint through the settings menu").toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.locator(".move-status")).toContainText("1. e4");
});

/** One floating surface: opens by its own summary, closes on Escape, and closes
 *  again on a pointer outside it. The titlebar text has no handler, so that click
 *  cannot move the board or the current ply. */
async function expectFloatingDismissal(page: Page, name: string, selector: string) {
  const details = page.locator(selector);
  const summary = details.locator("summary").first();
  await summary.click();
  await expect(details, `${name} opens`).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(details, `${name} closes on Escape`).not.toHaveAttribute("open", "");
  await summary.click();
  await expect(details, `${name} reopens`).toHaveAttribute("open", "");
  await page.locator(".review-title strong").click();
  await expect(details, `${name} closes on an outside pointer`).not.toHaveAttribute("open", "");
}

test("floating review surfaces dismiss; the report behind them does not", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockLocalAi(page, "available");
  await openReview(page);

  // Content disclosures are not floating surfaces: the Game Summary, the engine
  // lines and the Why? evidence stay open while the visitor steps the game, because
  // clicking Next move must not close the report being read.
  await openReviewGameSummary(page);
  await openReviewEngineLines(page);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.locator("details.move-verdict-why > summary").click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator("details.game-summary-section")).toHaveAttribute("open", "");
  await expect(page.locator("details.review-engine-lines")).toHaveAttribute("open", "");
  await expect(page.locator("details.move-verdict-why")).toHaveAttribute("open", "");

  // Every floating surface the dismissal hook owns, in the Stockfish lens.
  for (const [name, selector] of [
    ["More", "details.review-more"],
    ["Export", ".review-actions details:not(.review-more)"],
  ] as const) {
    await expectFloatingDismissal(page, name, selector);
  }

  // The Maia lens swaps the objective verdict for the dual verdict and mounts the
  // quick-settings chip, which is a floating surface on the same rule.
  await page.locator(".lens-switch").getByRole("button", { name: /Maia/ }).click();
  await expect(page.locator("details.human-quick-settings")).toBeVisible();
  await expectFloatingDismissal(page, "Maia settings", "details.human-quick-settings");

  // Dismissing the panels left the report that was open before them still open.
  await expect(page.locator("details.game-summary-section")).toHaveAttribute("open", "");
});

/* A disclosure is still laid out inside something, and a card that opens past its
   holder's box is cut off by it: the Why? evidence used to hang past the context
   panel — 150px left of it at a 1280px window — which took its label column with
   it, and it covered whatever sat underneath. */
test("floating surfaces stay inside the panel that holds them", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockLocalAi(page, "available");
  await openReview(page);
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator("details.move-verdict-why")).toBeVisible();

  const contextPanel = page.locator(".context-panel");
  const inside = async (name: string, popover: Locator) => {
    const [panel, holder] = await Promise.all([popover.boundingBox(), contextPanel.boundingBox()]);
    expect(panel, `${name} must be laid out`).not.toBeNull();
    expect(holder).not.toBeNull();
    expect(
      Math.round(panel!.x),
      `${name} opens at ${Math.round(panel!.x)}px, left of the context panel at ${Math.round(holder!.x)}px`,
    ).toBeGreaterThanOrEqual(Math.round(holder!.x) - 1);
    expect(
      Math.round(panel!.x + panel!.width),
      `${name} ends past the context panel's right edge`,
    ).toBeLessThanOrEqual(Math.round(holder!.x + holder!.width) + 1);
  };

  await page.locator("details.move-verdict-why > summary").click();
  await inside("the Why? evidence", page.locator(".move-verdict-evidence"));
  // The labels carry the reading: geometry that fits but hides them is not the fix.
  const panelBox = (await contextPanel.boundingBox())!;
  for (const label of ["Engine", "Winning chances", "Accuracy", "Search"]) {
    const box = await page.locator(".move-verdict-evidence dt", { hasText: label }).first().boundingBox();
    expect(box, `${label} must be laid out`).not.toBeNull();
    expect(Math.round(box!.x), `${label} must not be clipped away`).toBeGreaterThanOrEqual(Math.round(panelBox.x));
  }

  await page.locator(".lens-switch").getByRole("button", { name: /Maia/ }).click();
  await page.locator("details.human-quick-settings > summary").click();
  await inside("the Maia quick settings", page.locator(".human-lens-controls"));
});

test("publishes the same shortcut list on Help", async ({ page }) => {
  await page.goto("/help");
  const section = page.locator("#shortcuts");
  await expect(section).toBeVisible();
  await expect(section.locator("dl > div")).toHaveCount(REVIEW_SHORTCUTS.length);
  await expect(section).toContainText("Previous move");
  await expect(section).toContainText("← / J");
  await expect(section).toContainText("exit focus board");
});

test("focus board maximizes the board and keeps an obvious exit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  const workspace = page.locator(".review-workspace");
  const panel = page.locator(".context-panel");
  await expect(panel).toBeVisible();
  const normal = await boardWidth(page);

  await page.keyboard.press("z");
  await expect(workspace).toHaveClass(/focus-board/);
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Exit focus board" })).toBeVisible();
  await expect.poll(() => boardWidth(page)).toBeGreaterThan(normal);
  // The board stays usable: transport and player strips are kept.
  await expect(page.getByRole("button", { name: "Next move" })).toBeVisible();
  await expect(page.locator(".player-strip").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(workspace).not.toHaveClass(/focus-board/);
  await expect(panel).toBeVisible();
  await expect.poll(() => boardWidth(page)).toBe(normal);

  await page.locator(".board-controls > summary").click();
  await page.getByRole("button", { name: "Focus board (Z)" }).click();
  await expect(workspace).toHaveClass(/focus-board/);
  // Focus is session state: a reload returns to the normal workspace.
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".board-controls > summary")).toBeVisible();
  await expect(workspace).not.toHaveClass(/focus-board/);
});

test("plays a move from the keyboard without dragging a piece", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();

  // Pieces and squares are named for assistive technology, and the draggable
  // piece element stays exposed: the square wrapper is a group, not an image.
  const g1 = page.locator('[data-square="g1"]');
  await expect(g1.locator('[role="group"]')).toHaveAttribute("aria-label", "Square g1");
  await expect(g1.getByRole("button", { name: "White knight on g1" })).toBeAttached();

  await page.locator(".board-controls > summary").click();
  const entry = page.getByLabel("Play a move");
  await entry.fill("Nf3");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Played Nf3." })).toBeVisible();
  await expect(page.locator(".move-status")).toContainText("Nf3");
  await expect(page.locator(".variation-banner")).toContainText("Analysis branch");

  // The workspace states the position for a screen reader: FEN on demand, and a
  // polite announcement of what just happened.
  await expect(page.locator(".sr-only").filter({ hasText: "Board position:" })).toContainText("5N2");
  await expect(page.locator(".sr-only").filter({ hasText: "Board position:" })).toContainText(" b ");
  await expect(page.locator('.sr-only[aria-live="polite"]')).toContainText("Analysis variation, Nf3.");
  await page.locator(".position-workspace .return-to-game").click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('.sr-only[aria-live="polite"]')).toContainText("1. e4. Black to move.");

  // UCI works too: black's move continues the mainline, and an illegal move is
  // refused with its reason instead of being ignored. Clicking the board closed
  // the settings menu, so typed entry has to be opened again.
  await page.locator(".board-controls > summary").click();
  await entry.fill("e7e5");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".move-status")).toContainText("e5");

  await entry.fill("Nf6");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".move-entry-error")).toContainText("is not a legal move");
  await expect(page.locator(".move-status")).toContainText("e5");

  // A promotion must name its piece, exactly as the board's chooser requires.
  await entry.fill("e7e8");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".move-entry-error")).toContainText("is not a legal move");
});
