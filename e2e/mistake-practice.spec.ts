import { expect, test, type Page } from "@playwright/test";
import { arrowCount, faultArrowCount } from "./arrow-helpers";
import { goToReviewSection, mockLocalAi, seedReview, writeStores } from "./fixtures";

test.use({ serviceWorkers: "block" });

function markPracticeFault(move: { fenBefore: string; stockfish: unknown; quality: string }) {
  const black = move.fenBefore.split(" ")[1] === "b";
  const bestMove = black ? "d7d5" : "d2d4";
  const second = black ? "g8f6" : "g1f3";
  const third = black ? "c7c5" : "f2f3";
  move.quality = "mistake";
  move.stockfish = { fen: move.fenBefore, depth: 12, score: { kind: "cp", cp: 22 }, bestMove, lines: [
    { rank: 1, depth: 12, score: { kind: "cp", cp: 22 }, pv: [bestMove, black ? "d2d4" : "d7d5"] },
    { rank: 2, depth: 12, score: { kind: "cp", cp: 18 }, pv: [second, black ? "d2d4" : "d7d5"] },
    { rank: 3, depth: 12, score: { kind: "cp", cp: -200 }, pv: [third] },
  ] };
}

async function enter(page: Page, {
  humanFacts = false,
  start = true,
  bookFault = false,
  faultPly = 1,
  extraFaultPly,
  knownSide = true,
  linked = false,
}: { humanFacts?: boolean; start?: boolean; bookFault?: boolean; faultPly?: number; extraFaultPly?: number; knownSide?: boolean; linked?: boolean } = {}) {
  await mockLocalAi(page, "offline");
  await page.route("**/api/platforms/lichess/config", (route) => route.fulfill({ json: { configured: false } }));
  await page.route("**/api/platforms/lichess/session", (route) => route.fulfill({ json: { connected: false } }));
  const fixture = await seedReview(page, { preferredOrientation: knownSide ? "white" : null });
  const faultPlies = extraFaultPly === undefined ? [faultPly] : [faultPly, extraFaultPly];
  fixture.analysis.moves.forEach((item, index) => {
    if (faultPlies.includes(index + 1)) {
      markPracticeFault(item);
      item.classificationReason = { ...item.classificationReason, isBook: false };
    } else { item.quality = "best"; item.annotations = []; }
  });
  const move = fixture.analysis.moves[faultPly - 1]!;
  if (bookFault) move.classificationReason = { ...move.classificationReason, isBook: true };
  if (humanFacts) {
    move.human = {
      version: "human-v2",
      model: "maia3-5m",
      targetElo: 1400,
      selfElo: 1400,
      opponentElo: 1400,
      candidates: [
        { uci: "e2e4", san: "e4", probability: 0.34, policyRank: 1 },
        { uci: "d2d4", san: "d4", probability: 0.03, policyRank: 6 },
      ],
      candidateProbabilityMass: 0.37,
      playedMoveProbability: 0.34,
      playedMoveRank: 1,
      modelPrediction: true,
      findDifficulty: { label: "natural", score: 12, evidence: { experimental: true, maiaProbability: 0.34, probabilityBand: "common", legalMoveCount: 20, isEngineBest: false, isForced: false, isForcing: false, isSacrifice: false, tacticalMotifCount: 0, adjustments: [] } },
    };
  }
  if (linked) {
    fixture.record.external = {
      provider: "chesscom",
      externalGameId: "fixture-practice",
      accountId: "chesscom:hikaru",
      username: "Hikaru",
      importedAt: "2026-08-23T00:00:00.000Z",
    };
    await writeStores(page, {
      "review-records": [[fixture.record.id, fixture.record]],
      "objective-analyses": [[fixture.cacheKey, fixture.analysis]],
    });
  } else {
    await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });
  }
  await page.goto(`/review/${fixture.record.id}`);
  if (start) await startButton(page).click();
  return fixture;
}

const panel = (page: Page) => page.locator(".retro-practice");
const startButton = (page: Page) => page.getByRole("button", { name: /Practice (White|Black)'s \d+ positions?/ });
const sideChooser = (page: Page) => page.getByRole("group", { name: "Which side to practise" });
const sideButton = (page: Page, color: "White" | "Black") => sideChooser(page).getByRole("button", { name: new RegExp(`^${color},`) });
const continueButton = (page: Page) => panel(page).getByRole("button", { name: /^(Next|View this session)$/ });
async function play(page: Page, from: string, to: string) {
  await page.locator(`.board-wrap [data-square="${from}"]`).first().click();
  await page.locator(`.board-wrap [data-square="${to}"]`).first().click();
}


test("solves in place on the review board with the answer hidden", async ({ page }) => {
  await enter(page);

  await expect(panel(page)).toContainText("Find a better move");
  await expect(panel(page)).toContainText("was played");
  expect(await arrowCount(page)).toBe(1);
  expect(await faultArrowCount(page)).toBe(1);
  await page.getByRole("button", { name: "Flip board" }).click();
  expect(await arrowCount(page)).toBe(1);
  expect(await faultArrowCount(page)).toBe(1);
  await page.getByRole("button", { name: "Flip board" }).click();
  await goToReviewSection(page, "Analysis");
  await expect(page.getByText("Engine lines are hidden while you solve this position.")).toBeVisible();
  await expect(page.locator(".candidate-list .candidate")).toHaveCount(0);
  await page.getByRole("link", { name: "Moves", exact: true }).click();
  const moveList = page.locator(".review-move-list");
  await expect(moveList).toContainText("Hidden while solving");
  await expect(moveList).not.toContainText("Mistake");
  // The icon and its tooltip also name the answer, so neither may leak it.
  const hiddenRow = moveList.locator("button").first();
  await expect(hiddenRow).toHaveAttribute("title", "Hidden while solving", { timeout: 5000 }).catch(async () => {
    // The title lives on the quality span, not the button.
    await expect(hiddenRow.locator(".move-quality")).toHaveAttribute("title", "Hidden while solving");
  });
  expect(await hiddenRow.locator("svg title, svg").first().innerHTML()).not.toContain("Blunder");
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(panel(page)).toContainText("Find a better move");

  // Jumping past the fault is refused: the session must not disclose it.
  // End is not bound to last-position; the transport button is the real path.
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.getByLabel("Persistent board workspace").getByText("Starting position", { exact: true })).toBeVisible();
  await expect(panel(page)).toContainText("Find a better move");
  await expect(panel(page)).toContainText("was played");

  // A wrong answer is rejected without leaving the prompt position. The board
  // deliberately ignores input until the attempted move has been taken back, so
  // wait for the session to be solving again: a loaded CI machine spends long
  // enough in that window for the clicks below to be dropped, which is how this
  // spec failed on every push while passing on a developer's machine.
  await play(page, "f2", "f3");
  await expect(panel(page)).toContainText("f3 does not keep the position");
  expect(await faultArrowCount(page)).toBe(0);
  await expect(page.getByLabel("Persistent board workspace").getByText("Starting position", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(panel(page)).toHaveAttribute("data-status", "solving", { timeout: 10_000 });

  // The engine's move solves it and stays on the board as a variation, so the
  // visitor can keep playing that line instead of snapping back to the prompt.
  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  expect(await faultArrowCount(page)).toBe(0);
  await expect(continueButton(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Variation end" })).toBeVisible();
});

test("view solution and skip both advance to completion", async ({ page }) => {
  await enter(page);

  await panel(page).getByRole("button", { name: "View the solution" }).click();
  // The stronger move is played onto the board as a variation, matching Lichess,
  // so the visitor can keep exploring that line.
  await expect(panel(page)).toContainText("Solution");
  await expect(panel(page)).toContainText("Best was");
  await expect(page.getByRole("button", { name: "Variation end" })).toBeVisible();
  await continueButton(page).click();
  await expect(panel(page)).toContainText("Reviewed");

  // Skip must actually advance rather than re-present the same position.
  await panel(page).getByRole("button", { name: "Retry unsolved positions" }).click();
  await expect(panel(page)).toContainText("Find a better move");
  await panel(page).getByRole("button", { name: "Skip", exact: true }).click();
  await expect(panel(page)).toContainText("Reviewed");
});

test("explains the original move through human behaviour when Maia facts exist", async ({ page }) => {
  await enter(page, { humanFacts: true });

  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  const human = panel(page).locator(".retro-human");
  await expect(human).toContainText("Why the original move felt natural");
  await expect(human).toContainText("34%");
  await expect(human).toContainText("1400");
});

test("offers no human explanation when no Maia facts were recorded", async ({ page }) => {
  await enter(page);
  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  await expect(panel(page).locator(".retro-human")).toHaveCount(0);
});

test("an engine failure is never counted as a wrong answer", async ({ page }) => {
  await page.route("**/engine/stockfish.js", (route) => route.abort());
  await enter(page);

  // A move absent from the saved MultiPV forces a live search that cannot start.
  await play(page, "b1", "c3");
  await expect(panel(page)).toContainText("could not verify");
  await expect(panel(page)).toContainText("Find a better move");
});

test("checks an unlisted move with real browser Stockfish instead of assuming it is wrong", async ({ page }) => {
  await enter(page);

  // c2c4 is not in the seeded MultiPV, so this exercises the whole live path:
  // restricted searchmoves → score → judgePracticeScore. The fixture's best line
  // is a realistic +22cp (what Stockfish actually reports here), and 1.c4 is
  // roughly +12cp, so a working pipeline accepts it. Requiring "Correct"
  // strictly is the point: a dead live path would leave the position unsolved
  // rather than quietly pass.
  await play(page, "c2", "c4");
  await expect(panel(page)).toContainText("That move keeps the position", { timeout: 60_000 });
  await expect(panel(page)).not.toContainText("could not verify");
});

test("withholds the Study explanation while an answer is owed, and restores it after solving", async ({ page }) => {
  // The lesson's validated line is anchored at the fault's fenAfter — the very
  // position being solved — so the Study panel must withhold it. The tab itself
  // stays reachable (it is a plain link), so the gate has to be in the panel.
  await enter(page);

  await page.getByRole("link", { name: "Study", exact: true }).click();
  await expect(page.getByText("The explanation is hidden while you solve this position.")).toBeVisible();
  // Assert the article is actually gone; asserting only the notice would stay
  // green even if the gate were removed from the article itself.
  await expect(page.locator(".coach-result")).toHaveCount(0);

  // Engine evidence is withheld on its tab too.
  await goToReviewSection(page, "Analysis");
  await expect(page.getByText("Engine lines are hidden while you solve this position.")).toBeVisible();

  // Solving restores every surface: the gate must be a pause, not an amputation.
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  await goToReviewSection(page, "Analysis");
  await expect(page.getByText("Engine lines are hidden while you solve this position.")).toHaveCount(0);
});

test("hides Maia human candidates while an answer is owed", async ({ page }) => {
  // Enhanced Local mode, so the Maia lens can actually produce candidates. The
  // lens is evidence about the prompt position and its rows play on click, so it
  // must be suppressed exactly like the engine evidence.
  await mockLocalAi(page, "available", { positionCandidates: ["e2e4", "d2d4"] });
  const fixture = await seedReview(page);
  const move = fixture.analysis.moves[0]!;
  move.quality = "mistake";
  move.stockfish = { fen: move.fenBefore, depth: 12, score: { kind: "cp", cp: 22 }, bestMove: "d2d4", lines: [
    { rank: 1, depth: 12, score: { kind: "cp", cp: 22 }, pv: ["d2d4", "d7d5"] },
  ] };
  fixture.analysis.moves.slice(1).forEach((item) => { item.quality = "best"; item.annotations = []; });
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });
  await page.goto(`/review/${fixture.record.id}`);

  await page.getByRole("button", { name: "Maia · " }).first().click().catch(() => undefined);
  await startButton(page).click();
  await expect(panel(page)).toContainText("Find a better move");
  await expect(page.locator(".human-lens-candidates")).toHaveCount(0);
  await expect(page.locator(".human-lens-content")).toHaveCount(0);

  // Solving restores the lens: the gate must pause evidence, not delete it.
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  await expect(page.locator(".human-lens-content")).toBeVisible();
  await expect(page.locator(".human-lens-content")).not.toContainText("hidden while you solve");
});

test("the practice panel stays inside a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page, { start: false });
  const setup = page.locator(".retro-idle");
  await expect(setup).toBeVisible();
  await expect(sideButton(page, "White")).toBeVisible();
  await expect(sideButton(page, "Black")).toBeVisible();
  expect(Math.round(await sideButton(page, "White").evaluate((element) => element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
  expect(await setup.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await startButton(page).click();
  const locked = page.locator(".retro-panel");
  await expect(locked).toBeVisible();
  expect(await locked.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("practice-mobile.png"), fullPage: true });
});

test("the side selector and the theory exclusion decide what Start offers", async ({ page }) => {
  // A fault that is still opening theory is deliberately excluded, which makes an
  // empty set normal in real games — so the panel's per-side availability logic
  // and its empty copy are worth pinning.
  const fixture = await enter(page, { start: false, bookFault: true, knownSide: false });
  const reviewUrl = page.url();
  const start = startButton(page);
  const empty = page.locator(".retro-practice .utility-note");

  // With nothing to practise the panel shows why, and offers no dead action.
  await expect(sideChooser(page)).toBeVisible();
  await expect(start).toHaveCount(0);
  await expect(empty).toContainText("White");
  // A fault existed and was skipped as theory, so the copy must say that rather
  // than claiming nothing was recorded.
  await expect(empty).toContainText("opening theory");
  await expect(empty).not.toContainText("No mistakes were recorded");
  await expect(empty).not.toContainText("try the other side");

  await sideButton(page, "Black").click();
  await expect(start).toHaveCount(0);
  await expect(empty).toContainText("Black");
  // Black genuinely has no fault, so here the "nothing recorded" copy is correct.
  await expect(empty).toContainText("No mistakes were recorded");

  // Clearing the theory flag makes the same side available, which proves the
  // exclusion is what gated it rather than a missing fault.
  const unbooked = structuredClone(fixture.analysis);
  unbooked.moves[0]!.classificationReason = { ...unbooked.moves[0]!.classificationReason, isBook: false };
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, unbooked]] });
  await page.goto(reviewUrl);
  await expect(startButton(page)).toBeEnabled();
});

test("a linked account with nothing to practise can still switch side", async ({ page }) => {
  await enter(page, { start: false, bookFault: true, linked: true });
  await expect(sideChooser(page)).toBeVisible();
  await sideButton(page, "Black").click();
  await expect(page.locator(".retro-practice .utility-note")).toContainText("Black");
});

test("an inaccuracy only becomes available when it is included", async ({ page }) => {
  const fixture = await enter(page, { start: false });
  const reviewUrl = page.url();
  // Make White's fault an inaccuracy only, which practice excludes by default.
  const relaxed = structuredClone(fixture.analysis);
  relaxed.moves[0]!.quality = "inaccuracy";
  relaxed.moves[0]!.annotations = [];
  relaxed.moves.slice(1).forEach((item) => { item.quality = "good"; item.annotations = []; });
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, relaxed]] });
  await page.goto(reviewUrl);

  const start = startButton(page);
  await expect(sideChooser(page)).toBeVisible();
  await expect(start).toHaveCount(0);
  await expect(sideButton(page, "White")).toHaveAttribute("aria-pressed", "true");
  await sideButton(page, "Black").click();
  await page.getByRole("checkbox", { name: "Include inaccuracies" }).check();
  // The filter changes White's count, not the selected side.
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");
  await expect(sideButton(page, "White")).toContainText("1 position");
  await expect(start).toHaveCount(0);
  await sideButton(page, "White").click();
  await expect(start).toBeEnabled();
  await expect(start).toHaveText(/White/);
});

test("the setup keeps both sides visible and starts the selected side", async ({ page }) => {
  await enter(page, { start: false });
  await expect(sideButton(page, "White")).toHaveAttribute("aria-pressed", "true");
  await expect(sideButton(page, "White")).toContainText("1 position");
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "false");
  await expect(sideButton(page, "Black")).toContainText("0 positions");
  await expect(startButton(page)).toHaveText(/White/);

  // Selecting the empty side never starts practice; it only changes the explanation.
  await sideButton(page, "Black").click();
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");
  await expect(startButton(page)).toHaveCount(0);
  await expect(page.locator(".retro-practice .utility-note")).toContainText("Black");
  await expect(panel(page)).not.toContainText("Find a better move");

  await sideButton(page, "White").click();
  await expect(startButton(page)).toHaveText(/White/);
  await startButton(page).click();
  await expect(panel(page)).toContainText("White to move");
  await panel(page).getByRole("button", { name: "Exit" }).click();
  await expect(page.locator(".retro-idle")).toBeVisible();
  await expect(sideButton(page, "White")).toHaveAttribute("aria-pressed", "true");
  await expect(sideButton(page, "Black")).toBeVisible();
});

test("each side keeps its own count when the other is empty or both have work", async ({ page }) => {
  await enter(page, { start: false, faultPly: 2 });
  await expect(sideButton(page, "White")).toContainText("0 positions");
  await expect(sideButton(page, "Black")).toContainText("1 position");
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");
  await expect(startButton(page)).toHaveText(/Black/);

  await enter(page, { start: false, extraFaultPly: 2 });
  await expect(sideButton(page, "White")).toContainText("1 position");
  await expect(sideButton(page, "Black")).toContainText("1 position");
  await expect(sideChooser(page)).toBeVisible();
});

test("the setup is keyboard operable", async ({ page }) => {
  await enter(page, { start: false, extraFaultPly: 2 });
  await sideButton(page, "White").focus();
  await expect(sideButton(page, "White")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sideButton(page, "Black")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox", { name: "Include inaccuracies" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(startButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toContainText("Black to move");
});

test("the selected side survives leaving the panel and resets on reload", async ({ page }) => {
  await enter(page, { start: false, extraFaultPly: 2 });
  await sideButton(page, "Black").click();
  await expect(startButton(page)).toHaveText(/Black/);

  await page.getByRole("link", { name: "Moves", exact: true }).click();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");

  await startButton(page).click();
  await panel(page).getByRole("button", { name: "Exit" }).click();
  await expect(page.locator(".retro-idle")).toBeVisible();
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.locator(".retro-idle")).toBeVisible();
  await expect(sideButton(page, "White")).toHaveAttribute("aria-pressed", "true");
});

test("a known learner colour still offers the other side", async ({ page }) => {
  await enter(page, { start: false, linked: true });
  await expect(sideChooser(page)).toBeVisible();
  await expect(sideButton(page, "White")).toHaveAttribute("aria-pressed", "true");
  await expect(startButton(page)).toHaveText(/White/);
  await sideButton(page, "Black").click();
  await expect(sideButton(page, "Black")).toHaveAttribute("aria-pressed", "true");
  await expect(startButton(page)).toHaveCount(0);
});

test("a mid-game fault hides the coach evidence for that ply", async ({ page }) => {
  // Every other fixture faults on ply 1, where the coach panel has no current
  // move and renders its game-facts branch instead. A real mistake is mid-game,
  // so this covers the redacted move-evidence branch as well.
  await enter(page, { faultPly: 9 });

  await page.getByRole("link", { name: "Study", exact: true }).click();
  await expect(page.getByText("The explanation is hidden while you solve this position.")).toBeVisible();
  const facts = page.locator(".coach-move-facts");
  await expect(facts).toBeVisible();
  await expect(facts).toContainText("Withheld while you solve this position.");
  // The eval, win% loss, rank and rule must all be redacted.
  for (const label of ["Eval", "Win% loss", "Engine rank", "Quality rule"]) {
    await expect(facts.locator("dt", { hasText: label }).locator("+ dd")).toHaveText("—");
  }
});

test("a correct move stays on the board so the line can be explored", async ({ page }) => {
  await enter(page);
  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  await expect(page.getByRole("button", { name: "Variation end" })).toBeVisible();

  await play(page, "d7", "d5");
  await expect(panel(page)).toContainText("not necessarily the only best move");
  await expect(panel(page)).toContainText("That move keeps the position");
  await continueButton(page).click();
  await expect(panel(page)).toContainText("Reviewed");
});

test("the header stays on the current exercise until Next is clicked", async ({ page }) => {
  await enter(page, { extraFaultPly: 9 });
  await expect(panel(page)).toContainText("1 / 2");
  await play(page, "d2", "d4");
  await expect(panel(page)).toContainText("That move keeps the position");
  await expect(panel(page)).toContainText("1 / 2");
  await continueButton(page).click();
  await expect(panel(page)).toContainText("2 / 2");
  await expect(panel(page)).toContainText("Find a better move");
});

test("browsing away from a prompt offers resume, not a leaked answer", async ({ page }) => {
  await enter(page, { faultPly: 9 });
  await expect(panel(page)).toContainText("Find a better move");
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(panel(page)).toContainText("You browsed away");
  await panel(page).getByRole("button", { name: "Resume learning" }).click();
  await expect(panel(page)).toContainText("Find a better move");
  await expect(panel(page)).toContainText("was played");
});

test("direct local same-origin mutations reach validation, foreign origins stay rejected", async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/platforms/chesscom/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 42 }) });
    return response.status;
  });
  expect(result).toBe(400);
  const cross = await page.request.post('/api/platforms/chesscom/sync', { headers: { Origin: 'https://foreign.example', 'Sec-Fetch-Site': 'cross-site' }, data: { username: 42 } });
  expect(cross.status()).toBe(403);
});
