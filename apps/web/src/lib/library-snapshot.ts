import type { HistoryAnalysisJobV1 } from "@chess-review/shared";
import { listAnalysisCacheProjections } from "./analysis-cache";
import { listHistoryAnalysisJobs } from "./history-analysis-jobs";
import { listReviewRecords } from "./review-library";
import { listSyncedGames } from "./platform-library";
import { listReviewRuns } from "./review-runs";
import { externalGameKey, indexReviewProjections, resolveReviewStatus } from "./review-status";

import { backfillReviewIdentities, type LibraryIndexProgress } from "./review-identity-backfill";

export async function loadLibrarySnapshot(signal?: AbortSignal, onProgress?: (progress: LibraryIndexProgress) => void) {
  const [records, games, projections, jobs, runs] = await Promise.all([
    listReviewRecords(), listSyncedGames(), listAnalysisCacheProjections(true), listHistoryAnalysisJobs(), listReviewRuns(),
  ]);
  await backfillReviewIdentities(records, signal, onProgress);
  signal?.throwIfAborted();
  const bySource = new Map(games.map((game) => [externalGameKey(game.external), game]));
  const byRun = new Map(runs.map((run) => [run.reviewId, run]));
  const index = indexReviewProjections(projections);
  // Resolve each source's newest job item once, instead of scanning the whole
  // durable job history separately for every synced library record.
  const latestJobs = new Map<string, HistoryAnalysisJobV1>();
  for (const job of jobs) for (const item of job.items) {
    const previous = latestJobs.get(item.gameId)?.items[0];
    if (!previous || item.updatedAt.localeCompare(previous.updatedAt) > 0) latestJobs.set(item.gameId, { ...job, items: [item] });
  }
  const statuses = new Map(records.map((record) => {
    const source = record.external ? bySource.get(externalGameKey(record.external)) : undefined;
    const job = source ? latestJobs.get(source.id) : undefined;
    return [record.id, resolveReviewStatus(record, index, source, byRun.get(record.id), job ? [job] : [])];
  }));
  return { records, games, statuses };
}
export type LibrarySnapshot = Awaited<ReturnType<typeof loadLibrarySnapshot>>;
