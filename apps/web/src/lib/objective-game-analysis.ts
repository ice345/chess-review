import {
  buildGameAnalysis,
  CLASSIFICATION_MULTI_PV,
  planObjectiveVerification,
} from "@chess-review/analysis";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { GameAnalysisV2, GameDivision, OpeningInfo } from "@chess-review/shared";
import {
  BrowserStockfishPool,
  STOCKFISH_VERSION,
  type GameReviewProgress,
} from "@chess-review/stockfish";

export interface ObjectiveGameAnalysisOptions {
  depth: number;
  division: GameDivision;
  opening: OpeningInfo | null;
  signal?: AbortSignal;
  onProgress?: (progress: GameReviewProgress) => void;
  createdAt?: string;
}

/**
 * Runs the canonical browser objective pipeline. Presentation preferences do
 * not enter this function: classification always starts with the same MultiPV
 * and selectively spends extra engine time only on consequential evidence.
 */
export async function analyzeObjectiveGame(
  game: NormalizedGame,
  pool: Pick<BrowserStockfishPool, "analyzeGame" | "verifyMoves">,
  options: ObjectiveGameAnalysisOptions,
): Promise<GameAnalysisV2> {
  const baseline = await pool.analyzeGame(game, {
    depth: options.depth,
    multiPv: CLASSIFICATION_MULTI_PV,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
  });
  const common = {
    game,
    ...(options.opening === null ? {} : { opening: options.opening }),
    division: options.division,
    stockfishVersion: STOCKFISH_VERSION,
    depth: options.depth,
    multiPv: CLASSIFICATION_MULTI_PV,
    createdAt: options.createdAt ?? new Date().toISOString(),
  } as const;
  const provisional = buildGameAnalysis({ ...common, ...baseline });
  const plan = planObjectiveVerification(provisional);
  if (plan.requests.length === 0) return provisional;

  const verified = await pool.verifyMoves(game, {
    depth: plan.depth,
    multiPv: plan.multiPv,
    plies: plan.requests.map((request) => request.ply),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
  });
  const positionAnalyses = [...baseline.positionAnalyses];
  for (const [index, analysis] of verified.positionAnalyses) positionAnalyses[index] = analysis;
  const playedMoveAnalyses = new Map(baseline.playedMoveAnalyses);
  for (const [ply, analysis] of verified.playedMoveAnalyses) playedMoveAnalyses.set(ply, analysis);
  const verificationReasons = new Map(plan.requests.map((request) => [request.ply, request.reasons]));

  return buildGameAnalysis({
    ...common,
    positionAnalyses,
    playedMoveAnalyses,
    verifiedPlies: new Set(plan.requests.map((request) => request.ply)),
    verificationReasons,
    requireVerifiedSpecialAnnotations: true,
  });
}
