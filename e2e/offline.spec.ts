import { expect, test, type Page } from "@playwright/test";
import { SHORT_ANALYSIS_PGN } from "./fixtures";

const OPERA = `[Event "Opera Game"]
[Site "Paris"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke of Brunswick and Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5
6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5
11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6
15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const keys = await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)));
    return [...new Set(keys.flat())].sort();
  });
}

async function review(page: Page, pgn: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(pgn);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible();
  return page.url();
}

// The offline contract is asserted in Chromium only, for two measured reasons:
// WebKit raises an internal error when Playwright navigates with the network
// emulated off, and both Firefox and WebKit fetch the engine wasm from the page
// context, where the service worker does not see the request. Chromium is where
// offline analysis is actually observable end to end.
test.skip(({ browserName }) => browserName !== "chromium", "Offline service worker behaviour is only observable in Chromium.");

// The authored pieces are cached cache-first under a versioned path; this asserts
// the path and the payload budget on the production build the worker serves.
test("the authored pieces load from one versioned path and are cached for offline use", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/");

  const pieceResources = () => page.evaluate(() => performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.includes("/pieces/"))
    .map((entry) => ({
      path: new URL(entry.name).pathname,
      transferSize: (entry as PerformanceResourceTiming).transferSize,
      decodedBodySize: (entry as PerformanceResourceTiming).decodedBodySize,
    })));

  await expect(page.locator(".home-board img").first()).toBeVisible();
  await expect.poll(async () => (await pieceResources()).length).toBeGreaterThanOrEqual(12);
  const first = await pieceResources();
  const paths = [...new Set(first.map((entry) => entry.path))].sort();
  // Every piece comes from the current version directory, so a released art
  // revision can never be answered from the previous one by the cache-first rule.
  expect(paths.some((path) => path.startsWith("/pieces/feather_porcelain_v1_1/"))).toBe(true);
  expect(paths.every((path) => path.startsWith("/pieces/feather_porcelain_v1_1/"))).toBe(true);
  for (const key of ["wK", "wQ", "wB"]) expect(paths).toContain(`/pieces/feather_porcelain_v1_1/${key}.png`);
  // The PNG board is heavier than SVG on purpose; this is the budget that buys the
  // authored shading, and it must not silently grow.
  const decoded = first.reduce((total, entry) => total + entry.decodedBodySize, 0);
  console.log(JSON.stringify({ pieceFiles: paths.length, decodedBytes: decoded }));
  expect(decoded).toBeLessThan(2 * 1024 * 1024);

  // A controlled revisit takes the pieces from the cache rather than the network.
  await page.reload();
  await expect(page.locator(".home-board img").first()).toBeVisible();
  const cached = await cachedPaths(page);
  expect(cached.filter((path) => path.startsWith("/pieces/")).every((path) => path.startsWith("/pieces/feather_porcelain_v1_1/"))).toBe(true);
});

test("a returning visitor keeps the engine and can reopen reviewed games offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // One reload so the document is controlled from its very first request.
  await page.goto("/");
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Two reviews: the second one proves client-side routes are stored too, since
  // navigating between routes never requests a document.
  const firstReview = await review(page, OPERA);
  const secondReview = await review(page, SHORT_ANALYSIS_PGN);
  const cached = await cachedPaths(page);
  console.log(JSON.stringify({ engine: cached.filter((path) => path.startsWith("/engine/")), pages: cached.filter((path) => !path.startsWith("/_next/")) }));
  expect(cached).toContain("/engine/stockfish.js");
  expect(cached).toContain("/engine/stockfish.wasm");
  await expect.poll(async () => {
    const paths = await cachedPaths(page);
    return paths.includes(new URL(firstReview).pathname) && paths.includes(new URL(secondReview).pathname);
  }, { timeout: 30_000 }).toBe(true);
  // `/api/*` is never intercepted, so server sessions and rate limits keep working.
  expect(cached.filter((path) => path.startsWith("/api/"))).toEqual([]);

  await context.setOffline(true);

  // Both reviewed games still render with no network at all.
  await page.goto(firstReview);
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible();
  await page.goto(secondReview);
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible();

  // An address that was never opened falls back to a page that explains itself.
  await page.goto("/training");
  await expect(page.getByRole("heading", { name: "This page needs one online visit first" })).toBeVisible();

  // With the network back but every engine request failing, a new game still
  // analyzes: the engine can only have come from the worker's cache.
  await context.setOffline(false);
  await page.route("**/engine/**", (route) => route.abort());
  await review(page, "1. d4 d5 2. c4 e6 3. Nc3 Nf6");
});
