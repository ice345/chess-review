import { expect, test, type Page } from "@playwright/test";

const ANNOTATED = `[Event "Annotated study"]
[Site "Paris"]
[White "Paul Morphy"]
[Black "Duke of Brunswick"]
[Result "1-0"]

{ A game worth studying }
1. e4 $1 { Best by test [%clk 0:06:15] } (1. d4 { [%clk 0:09:57] } d5 2. c4) e5 2. Nf3 Nc6 3. Bb5 a6 *`;

const SHARED = `[Event "Shared study"]
[White "Ünïcode Nàme"]
[Black "Player two"]
[Result "*"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 *`;

/** The menu exposes the link as a field, so the test never depends on clipboard permissions, which Firefox and WebKit do not support. */
async function shareLinkFromMenu(page: Page): Promise<string> {
  await page.getByText("Export", { exact: true }).click();
  await page.getByRole("button", { name: "Copy share link" }).click();
  const field = page.getByLabel("Share link");
  await expect(field).toBeVisible();
  return field.inputValue();
}

test("a share link imports the game into a fresh browser", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(SHARED);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 120_000 });

  const shareUrl = await shareLinkFromMenu(page);
  console.log(JSON.stringify({ shareUrlLength: shareUrl.length }));
  expect(shareUrl).toContain("/share#pgn=");

  // A brand new browser context stands in for the recipient: nothing is shared
  // with the sender except the URL itself.
  const recipient = await browser.newContext();
  try {
    const tab = await recipient.newPage();
    await tab.goto(shareUrl);
    await expect(tab).toHaveURL(/\/review\/[a-f0-9]+$/, { timeout: 60_000 });
    await expect(tab.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 120_000 });
    const titlebar = (await tab.locator(".review-titlebar").innerText()).replace(/\s+/g, " ");
    console.log(JSON.stringify({ recipientUrl: new URL(tab.url()).pathname, titlebar }));
    // Non-ASCII player names survived the link. The event subtitle is not
    // asserted because narrow layouts legitimately hide it.
    expect(titlebar).toContain("Ünïcode Nàme");
    expect(titlebar).toContain("Player two");
  } finally {
    await recipient.close();
  }
});

test("an incomplete share link explains itself", async ({ page }) => {
  await page.goto("/share#pgn=");
  await expect(page.getByRole("heading", { name: "Incomplete share link" })).toBeVisible();

  await page.goto("/share#pgn=not-valid-base64!!");
  await expect(page.getByRole("heading", { name: /Invalid share link|Import failed/ })).toBeVisible();
});

test("shows imported comments, glyphs and variations", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(ANNOTATED);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 120_000 });

  await page.getByRole("link", { name: "Moves", exact: true }).click();
  const rows = page.locator(".review-move-list > button");
  await expect(rows.first()).toBeVisible();

  const firstRow = await rows.first().innerText();
  const comment = await page.locator(".move-imported-comment").first().innerText();
  const variation = await page.locator(".move-imported-variation").first().innerText();
  const glyph = await page.locator(".move-imported-glyph").first().innerText();

  await rows.first().click();
  const note = await page.locator(".move-imported-note").first().innerText();

  console.log(JSON.stringify({ firstRow: firstRow.replace(/\s+/g, " "), comment, variation, glyph, note }));

  expect(comment).toContain("Best by test");
  expect(comment).not.toContain("clk");
  expect(comment).not.toContain("0:06:15");
  expect(variation).toContain("1. d4 d5");
  expect(variation).not.toContain("clk");
  expect(variation).not.toContain("0:09:57");
  expect(glyph).toBe("!");
  expect(note).toContain("Best by test");
  expect(note).not.toContain("clk");
  expect(firstRow).toContain("e4");
});

test("exports an annotated PGN that keeps the imported annotations", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(ANNOTATED);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 120_000 });

  await page.getByText("Export", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Annotated PGN" }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const pgn = Buffer.concat(chunks).toString("utf8");
  console.log(JSON.stringify({ excerpt: pgn.slice(pgn.indexOf("1. e4"), pgn.indexOf("1. e4") + 260) }));

  expect(pgn).toContain("Best by test");
  expect(pgn).toContain("$1");
  expect(pgn).toContain("(1. d4 { [%clk 0:09:57] } d5 2. c4)");

  // The annotated export must remain importable: the same app has to be able to
  // read back what it wrote, including the NAGs, comments and variation.
  await page.goto("/");
  await page.getByRole("textbox", { name: "Paste a complete PGN" }).fill(pgn);
  await page.getByRole("button", { name: "Analyze game →", exact: true }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("link", { name: "Moves", exact: true }).click();
  await expect(page.locator(".move-imported-comment").first()).toContainText("Best by test");
  await expect(page.locator(".move-imported-variation").first()).toContainText("1. d4 d5");
});
