import { expect, test } from "@playwright/test";
import { buildReviewRecord } from "../apps/web/src/lib/review-library";
import { SHORT_ANALYSIS_PGN, writeStores } from "./fixtures";

test("cancel and retry remain usable with constrained browser resources", async ({ page, context, browserName }, info) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  // CDP throttling is available only in Chromium; this is emulation, not NUC measurement.
  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const record = await buildReviewRecord('pgn', SHORT_ANALYSIS_PGN);
  await writeStores(page, { 'review-records': [[record.id, record]] });
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'Depth', exact: true }).selectOption('10');
  await page.goto(`/review/${record.id}`);
  await page.getByRole('button', { name: 'Analyze game', exact: true }).click();
  const started = performance.now();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyze game', exact: true })).toBeVisible();
  const cancellationMs = performance.now() - started;
  await info.attach('cancel-timing.json', { body: JSON.stringify({ cancellationMs, cpuSlowdown: browserName === 'chromium' ? 4 : null, emulatedCores: 2 }), contentType: 'application/json' });
  expect(cancellationMs).toBeLessThan(10_000);
  await page.goto('/history');
  await expect(page.locator('.history-summary')).toContainText('0 Analyzed');
  await expect(page.locator('.history-list')).toContainText('Cancelled');
  await page.goto(`/review/${record.id}`);
  await page.getByRole('button', { name: 'Analyze game', exact: true }).click();
  await expect(page.getByText('MOVE QUALITY', { exact: true })).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(page.getByText('MOVE QUALITY', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('standalone ships health identity, worker assets and private API headers', async ({ request }) => {
  const health = await request.get('/api/healthz');
  expect(await health.json()).toMatchObject({ status: 'ok', release: expect.any(String) });
  expect(health.headers()['cache-control']).toBe('no-store');
  const response = await request.get('/api/platforms/lichess/config');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  const help = await request.get('/help');
  expect(help.headers()['x-content-type-options']).toBe('nosniff');
  expect(help.headers()['x-powered-by']).toBeUndefined();
});
