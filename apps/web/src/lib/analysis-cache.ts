import { COACH_PROMPT_VERSION, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { GameAnalysisV1 } from "@chess-review/shared";
import { STOCKFISH_VERSION } from "@chess-review/stockfish";
import { ANALYSIS_STORE, openReviewDatabase } from "./browser-storage";

export interface AnalysisCacheOptions {
  depth: number;
  multiPv: number;
}

export function withoutStaleCoach(analysis: GameAnalysisV1): GameAnalysisV1 {
  const moves = analysis.moves.map((move) => {
    if (!move.coach || move.coach.source.promptVersion === COACH_PROMPT_VERSION) return move;
    const canonicalMove = { ...move };
    delete canonicalMove.coach;
    return canonicalMove;
  });
  if (!analysis.coachSummary || analysis.coachSummary.source.promptVersion === COACH_PROMPT_VERSION) {
    return { ...analysis, moves };
  }
  const canonicalAnalysis = { ...analysis };
  delete canonicalAnalysis.coachSummary;
  return { ...canonicalAnalysis, moves };
}

async function cacheKey(game: NormalizedGame, options: AnalysisCacheOptions): Promise<string> {
  const identity = [
    OBJECTIVE_ALGORITHM_VERSION,
    STOCKFISH_VERSION,
    options.depth,
    options.multiPv,
    game.initialFen,
    game.pgn,
  ].join("\u0000");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getCachedAnalysis(
  game: NormalizedGame,
  options: AnalysisCacheOptions,
): Promise<GameAnalysisV1 | null> {
  const database = await openReviewDatabase();
  try {
    const key = await cacheKey(game, options);
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).get(key);
      request.onsuccess = () => {
        const cached = request.result as GameAnalysisV1 | undefined;
        resolve(cached ? withoutStaleCoach(cached) : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Unable to read the analysis cache."));
    });
  } finally {
    database.close();
  }
}

export async function putCachedAnalysis(
  game: NormalizedGame,
  options: AnalysisCacheOptions,
  analysis: GameAnalysisV1,
): Promise<void> {
  const database = await openReviewDatabase();
  try {
    const key = await cacheKey(game, options);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ANALYSIS_STORE, "readwrite");
      transaction.objectStore(ANALYSIS_STORE).put(analysis, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write the analysis cache."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Analysis cache write was aborted."));
    });
  } finally {
    database.close();
  }
}
