import { expect, test, type Page } from "@playwright/test";
import { mockLocalAi, seedReview, writeStores } from "./fixtures";

async function enter(page: Page) {
  await mockLocalAi(page, "offline");
  const fixture = await seedReview(page);
  // Synthetic classification fixture: deterministic exercise UI, not an
  // assertion that 1.e4 is a real chess mistake.
  const move = fixture.analysis.moves[0]!;
  move.quality = "mistake";
  move.stockfish = { fen: move.fenBefore, depth: 12, score: { kind: "cp", cp: 300 }, bestMove: "d2d4", lines: [
    { rank: 1, depth: 12, score: { kind: "cp", cp: 300 }, pv: ["d2d4", "d7d5"] },
    { rank: 2, depth: 12, score: { kind: "cp", cp: 295 }, pv: ["g1f3", "d7d5"] },
    { rank: 3, depth: 12, score: { kind: "cp", cp: -200 }, pv: ["f2f3"] },
  ] };
  fixture.analysis.moves.slice(1).forEach((item) => { item.quality = "best"; item.annotations = []; });
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });
  await page.goto(`/review/${fixture.record.id}`);
  await page.getByRole("button", { name: "Practice my mistakes" }).click();
  return page.getByRole("dialog", { name: "Mistake practice", exact: true });
}
async function answer(page: Page, uci: string) {
  await page.getByLabel("Your move (UCI)").fill(uci);
  await page.getByRole("button", { name: "Check move", exact: true }).click();
}

test('hides answers, retries legal errors and accepts a near-best alternative with a hint', async ({ page }) => {
  const dialog = await enter(page);
  await expect(dialog).not.toContainText('d4 d5');
  await answer(page, 'e2e5'); await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('not legal');
  await answer(page, 'e2e4'); await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('played in the game');
  await answer(page, 'f2f3'); await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('Try again');
  await dialog.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('d2');
  await answer(page, 'g1f3'); await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('Solved with a hint');
  await dialog.getByRole('button', { name: 'Next line move' }).click();
  await dialog.getByRole('button', { name: 'Next position', exact: true }).click();
  await expect(dialog).toContainText('0 solved without hints · 1 solved with hints');
});

test('board input solves independently, reveal and skip remain separate outcomes', async ({ page }) => {
  const dialog = await enter(page);
  await dialog.locator('[data-square="d2"]').click(); await dialog.locator('[data-square="d4"]').click();
  await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('Solved without hints');
  await dialog.getByRole('button', { name: 'Next position', exact: true }).click();
  await expect(dialog).toContainText('1 solved without hints');
  await dialog.getByRole('button', { name: 'Practice again' }).click();
  await dialog.getByRole('button', { name: 'Show answer' }).click();
  await expect(dialog).toContainText('d4 d5');
  await dialog.getByRole('button', { name: 'Next position', exact: true }).click();
  await expect(dialog).toContainText('0 solved without hints · 0 solved with hints · 1 answers viewed');
  await dialog.getByRole('button', { name: 'Practice again' }).click();
  await dialog.getByRole('button', { name: 'Skip position' }).click();
  await expect(dialog).toContainText('1 skipped');
});

test('engine failure is not a wrong answer, filters and narrow layout remain usable', async ({ page }) => {
  await page.route('**/engine/stockfish.js', (route) => route.abort());
  const dialog = await enter(page);
  await answer(page, 'a2a3'); await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('failed to load');
  await expect(dialog.getByRole('button', { name: 'Check move', exact: true })).toBeVisible();
  await dialog.getByLabel('Practice side').selectOption('black');
  await expect(dialog).toContainText('No eligible mistakes');
  await dialog.getByLabel('Practice side').selectOption('white');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('practice-mobile.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Close practice' }).click();
  await expect(dialog).not.toBeVisible();
});

test('direct local same-origin mutations reach validation, foreign origins stay rejected', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/platforms/chesscom/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 42 }) });
    return response.status;
  });
  expect(result).toBe(400);
  const cross = await page.request.post('/api/platforms/chesscom/sync', { headers: { Origin: 'https://foreign.example', 'Sec-Fetch-Site': 'cross-site' }, data: { username: 42 } });
  expect(cross.status()).toBe(403);
});

test('cancels a stalled engine check without counting a wrong answer and can retry', async ({ page }) => {
  await page.route('**/engine/stockfish.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'self.onmessage = () => {};' }));
  const dialog = await enter(page);
  await answer(page, 'a2a3');
  await dialog.getByRole('button', { name: 'Cancel check' }).click();
  await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('not marked wrong');
  await answer(page, 'd2d4');
  await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText('Solved without hints');
});

test('checks an unlisted alternative with real browser Stockfish instead of assuming it is wrong', async ({ page }) => {
  test.setTimeout(60_000);
  const dialog = await enter(page);
  await answer(page, 'c2c4');
  await expect(dialog.getByRole('status', { name: 'Answer feedback' })).toContainText(/Stockfish’s top choice|near-best alternative|does not preserve/, { timeout: 35_000 });
});
