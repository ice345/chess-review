import { withReviewRun } from "./review-runs";
import { CLASSIFICATION_MULTI_PV, divideGame } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import { recognizeOpening } from "@chess-review/openings";
import type { GameAnalysisV2, SyncedGame } from "@chess-review/shared";
import { BrowserStockfishPool } from "@chess-review/stockfish";
import { getCachedAnalysis, putCachedAnalysis } from "./analysis-cache";
import { analysisScheduler } from "./analysis-scheduler";
import { loadAppSettings } from "./app-settings";
import { markSyncedGameAnalyzed } from "./platform-library";
import type { PlatformSyncMode } from "./platform-sync";
import { analyzeObjectiveGame } from "./objective-game-analysis";
import { buildReviewRecordFromSyncedGame, saveReviewRecord } from "./review-library";

/**
 * What happens to freshly synced games, on both the landing desk and the import
 * desk: an incremental sync may auto-analyse the newest few, a full import never
 * starts work on its own. The caller refreshes its library afterwards.
 */
export async function applySyncedAnalysisPolicy(
  games: SyncedGame[],
  mode: PlatformSyncMode,
  complete = true,
): Promise<void> {
  if (mode !== "incremental" || !complete) return;
  const settings = loadAppSettings();
  const selected = games.slice(0, settings.autoAnalyzeImported);
  if (selected.length > 0) await autoAnalyzeSyncedGames(selected, { depth: settings.reviewDepth, multiPv: settings.reviewMultiPv });
}

/**
 * Optional conservative account-sync policy. Games are analyzed strictly in
 * sequence so browser Stockfish, Maia and coach workloads never fan out, while
 * a single game may still use the device's worker budget like a manual review.
 */
export async function autoAnalyzeSyncedGames(
  games: SyncedGame[],
  options: { depth: 10 | 12 | 15; multiPv: 1 | 2 | 3 | 4 | 5 },
): Promise<number> {
  let completed = 0;
  for (const syncedGame of games) {
    await analyzeSyncedGame(syncedGame, options);
    completed += 1;
  }
  return completed;
}

export interface AnalyzeSyncedGameResult {
  analysis: GameAnalysisV2;
  analysisId: string;
  cached: boolean;
}

export async function analyzeSyncedGame(
  syncedGame: SyncedGame,
  options: { depth: 10 | 12 | 15; multiPv?: 1 | 2 | 3 | 4 | 5; signal?: AbortSignal },
): Promise<AnalyzeSyncedGameResult> {
  const game = parsePgn(syncedGame.pgn);
  // Parse before creating the external review shell. A provider-side invalid
  // PGN should remain a visible sync/job error, not leave an orphan review
  // record that can later be paired with another game's shared cache.
  const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(syncedGame));
  return withReviewRun(record.id, options.depth, async (signal, report) => {
    const cacheOptions = { depth: options.depth, multiPv: CLASSIFICATION_MULTI_PV };
    let analysis = await getCachedAnalysis(game, cacheOptions);
    const cached = analysis !== null;
    if (!analysis) {
      const pool = new BrowserStockfishPool();
      try {
        const division = divideGame(game);
        const opening = recognizeOpening(game) ?? null;
        analysis = await analysisScheduler.run(
          "background-game",
          () => analyzeObjectiveGame(game, pool, {
            depth: options.depth,
            division,
            opening,
            signal, onProgress: report,
          }),
          signal,
        );
        await putCachedAnalysis(game, cacheOptions, analysis);
      } finally {
        pool.terminate();
      }
    }
    await markSyncedGameAnalyzed(syncedGame.id, record.id, {
      algorithmVersion: analysis.algorithmVersion,
      depth: options.depth,
    });
    signal.throwIfAborted();
    return { analysis, analysisId: record.id, cached };
  }, options.signal);
}
