import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { parsePgn } from "@chess-review/chess-core";
import { buildReviewIdentity } from "../apps/web/src/lib/review-identity";
import { reviewFixture, writeStores } from "./fixtures";

const legacy = process.env.BENCHMARK_LEGACY === "1";

for (const count of [1_000, 10_000]) {
  test(`${legacy ? "legacy" : "indexed"} ${count} stored PGNs: cold library, revisit, search and bounded rows`, async ({ page }, info) => {
    const { record } = await reviewFixture();
    // Unique headers, identical legal 21-ply mainline: reproducible storage and
    // lifecycle workload. This is not 10,000 Stockfish analyses or a NUC CPU model.
    const parsed = parsePgn(record.input);
    const records = Array.from({ length: count }, (_, index) => {
      const value = { ...record, id: `benchmark-${index}`, title: `Player ${index} vs Mikhail`,
        input: record.input.replace("Ada", `Player ${index}`), originalPgn: undefined };
      const indexed = { ...value, identity: legacy ? undefined : buildReviewIdentity(value.input, parsed) };
      return [value.id, indexed] as [string, typeof value];
    });
    await writeStores(page, { "review-records": records });
    await page.addInitScript(() => {
      (window as unknown as { benchmarkLongTasks: number[] }).benchmarkLongTasks = [];
      new PerformanceObserver((list) => {
        (window as unknown as { benchmarkLongTasks: number[] }).benchmarkLongTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: "longtask", buffered: true });
    });
    const measurements: Record<string, unknown> = { count, mode: legacy ? "legacy-upgrade" : "indexed", gamePlies: record.totalPlies, browser: info.project.name };
    let started = performance.now();
    await page.goto("/history");
    await expect(page.locator(".history-summary")).toContainText(`${count} All records`);
    measurements.coldMs = performance.now() - started;
    if (!legacy) expect(measurements.coldMs).toBeLessThan(5_000);
    measurements.longTasksMs = await page.evaluate(() => (window as unknown as { benchmarkLongTasks: number[] }).benchmarkLongTasks);
    expect(await page.locator(".library-score").count()).toBe(60);
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    started = performance.now();
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page.locator(".history-summary")).toContainText(`${count} All records`);
    measurements.revisitMs = performance.now() - started;
    started = performance.now();
    await page.getByPlaceholder("Search a player, opening, or event").fill(`Player ${count - 1} vs`);
    await expect(page.locator(".history-summary")).toContainText("1 All records");
    measurements.searchMs = performance.now() - started;
    measurements.storage = await page.evaluate(async () => navigator.storage.estimate());
    await writeFile(info.outputPath(`library-${count}.json`), JSON.stringify(measurements, null, 2));
    console.log(JSON.stringify(measurements));
  });
}
