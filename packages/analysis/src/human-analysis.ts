import { Chess } from "chess.js";
import type { HumanAnalysis, MaiaModel, MaiaMoveReview, MoveAnalysis } from "@chess-review/shared";
import { humanFindDifficulty } from "./human-difficulty";

export const HUMAN_ANALYSIS_VERSION = "human-v2" as const;

export function matchesHumanAnalysisIdentity(
  human: HumanAnalysis | undefined,
  model: MaiaModel,
  targetElo: number,
): human is HumanAnalysis {
  return human?.version === HUMAN_ANALYSIS_VERSION
    && human.model === model
    && human.targetElo === targetElo;
}

function isForcingMove(move: MoveAnalysis): boolean {
  const board = new Chess(move.fenBefore);
  const played = board.move({
    from: move.uci.slice(0, 2),
    to: move.uci.slice(2, 4),
    ...(move.uci.length === 5 ? { promotion: move.uci[4] } : {}),
  });
  if (!played) throw new Error(`Canonical move ${move.uci} is not legal in its stored FEN.`);
  return played.isCapture() || played.san.includes("+") || played.san.includes("#");
}

/** Builds the persisted, evidence-bearing human analysis for exactly one move. */
export function buildHumanAnalysis(move: MoveAnalysis, review: MaiaMoveReview): HumanAnalysis {
  if (review.fenBefore !== move.fenBefore || review.playedMove !== move.uci) {
    throw new Error(`Maia move review does not match canonical ply ${move.ply}.`);
  }

  return {
    version: HUMAN_ANALYSIS_VERSION,
    model: review.model,
    targetElo: review.targetElo,
    selfElo: review.selfElo,
    opponentElo: review.opponentElo,
    candidates: review.candidates,
    candidateProbabilityMass: review.candidateProbabilityMass,
    playedMoveProbability: review.playedMoveProbability,
    playedMoveRank: review.playedMoveRank,
    ...(review.expectedHumanMove === undefined ? {} : { expectedHumanMove: review.expectedHumanMove }),
    ...(review.playedMoveWdl === undefined ? {} : { playedMoveWdl: review.playedMoveWdl }),
    modelPrediction: true,
    findDifficulty: humanFindDifficulty({
      playedMoveProbability: review.playedMoveProbability,
      legalMoveCount: move.classificationReason.legalMoveCount,
      ...(move.classificationReason.secondBestGapCp === undefined
        ? {}
        : { secondBestGapCp: move.classificationReason.secondBestGapCp }),
      ...(move.classificationReason.secondBestGapWinPercent === undefined
        ? {}
        : { secondBestGapWinPercent: move.classificationReason.secondBestGapWinPercent }),
      isEngineBest: move.classificationReason.isEngineBest,
      isForced: move.classificationReason.isForced,
      isForcing: isForcingMove(move),
      isSacrifice: move.classificationReason.sacrifice?.genuine ?? false,
      tacticalMotifCount: move.motifs.length,
    }),
  };
}
