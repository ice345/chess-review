import { CLASSIFICATION_MULTI_PV, divideGame } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import { recognizeOpening } from "@chess-review/openings";
import type { GameAnalysisV2, SyncedGame } from "@chess-review/shared";
import { BrowserStockfishPool } from "@chess-review/stockfish";
import { getCachedAnalysis, putCachedAnalysis } from "./analysis-cache";
import { analysisScheduler } from "./analysis-scheduler";
import { markSyncedGameAnalyzed } from "./platform-library";
import { analyzeObjectiveGame } from "./objective-game-analysis";
import { buildReviewRecordFromSyncedGame, saveReviewRecord } from "./review-library";

/**
 * Optional conservative account-sync policy. Games are analyzed strictly in
 * sequence so browser Stockfish, Maia and coach workloads never fan out.
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
  const cacheOptions = { depth: options.depth, multiPv: CLASSIFICATION_MULTI_PV };
  let analysis = await getCachedAnalysis(game, cacheOptions).catch(() => null);
  const cached = analysis !== null;
  if (!analysis) {
    const pool = new BrowserStockfishPool(1);
    try {
      const division = divideGame(game);
      const opening = recognizeOpening(game) ?? null;
      analysis = await analysisScheduler.run(
        "background-game",
        () => analyzeObjectiveGame(game, pool, {
          depth: options.depth,
          division,
          opening,
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        }),
        options.signal,
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
  return { analysis, analysisId: record.id, cached };
}
