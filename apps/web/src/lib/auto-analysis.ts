import { buildGameAnalysis, divideGame } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import { recognizeOpening } from "@chess-review/openings";
import type { SyncedGame } from "@chess-review/shared";
import { BrowserStockfishPool, STOCKFISH_VERSION } from "@chess-review/stockfish";
import { getCachedAnalysis, putCachedAnalysis } from "./analysis-cache";
import { markSyncedGameAnalyzed } from "./platform-library";
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
    const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(syncedGame));
    const game = parsePgn(syncedGame.pgn);
    const cached = await getCachedAnalysis(game, options).catch(() => null);
    if (!cached) {
      const pool = new BrowserStockfishPool();
      try {
        const division = divideGame(game);
        const opening = recognizeOpening(game) ?? undefined;
        const engineFacts = await pool.analyzeGame(game, options);
        const analysis = buildGameAnalysis({
          game,
          ...engineFacts,
          ...(opening === undefined ? {} : { opening }),
          division,
          stockfishVersion: STOCKFISH_VERSION,
          ...options,
          createdAt: new Date().toISOString(),
        });
        await putCachedAnalysis(game, options, analysis);
      } finally {
        pool.terminate();
      }
    }
    await markSyncedGameAnalyzed(syncedGame.id, record.id);
    completed += 1;
  }
  return completed;
}
