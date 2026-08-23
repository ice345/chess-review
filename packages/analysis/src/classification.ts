import type {
  ClassificationReason,
  EngineScore,
  MoveClassification,
  PlayerColor,
  SacrificeEvidence,
} from "@chess-review/shared";
import { centipawnsForColor, hasForcedMateFor } from "./score";
import { winPercentFromScore } from "./win-percent";

export interface ClassificationInput {
  color: PlayerColor;
  scoreBefore: EngineScore;
  scoreAfter: EngineScore;
  playedMoveRank?: number;
  secondBestScore?: EngineScore;
  legalMoveCount: number;
  isBook: boolean;
  isCheckmate: boolean;
  isObviousRecapture?: boolean;
  isTrivialCheckEscape?: boolean;
  playedMoveOutsideMultiPv?: boolean;
  hasTacticalBestLine?: boolean;
  sacrifice?: SacrificeEvidence;
}

export interface ClassificationResult {
  classification: MoveClassification;
  reason: ClassificationReason;
}

export const CLASSIFICATION_THRESHOLDS = {
  brilliantWinPercentLoss: 1,
  greatSecondBestGapCp: 150,
  greatSecondBestGapWinPercent: 10,
  bookMaxWinPercentLoss: 3,
  excellentCpLoss: 15,
  interestingCpLoss: 30,
  goodCpLoss: 60,
  inaccuracyCpLoss: 120,
  mistakeCpLoss: 250,
  missedWinChanceBefore: 92,
  missedWinDrop: 30,
  missDrop: 25,
} as const;

function moverWinPercent(score: EngineScore, color: PlayerColor): number {
  const white = winPercentFromScore(score);
  return color === "white" ? white : 100 - white;
}

export function classifyMove(input: ClassificationInput): ClassificationResult {
  const before = moverWinPercent(input.scoreBefore, input.color);
  const after = moverWinPercent(input.scoreAfter, input.color);
  const loss = Math.max(0, before - after);
  const beforeCp = centipawnsForColor(input.scoreBefore, input.color);
  const afterCp = centipawnsForColor(input.scoreAfter, input.color);
  const centipawnLoss = beforeCp === null || afterCp === null ? undefined : Math.max(0, beforeCp - afterCp);
  const secondCp = input.secondBestScore ? centipawnsForColor(input.secondBestScore, input.color) : null;
  const secondBestGapCp = beforeCp === null || secondCp === null ? undefined : Math.max(0, beforeCp - secondCp);
  const secondBestGapWinPercent = input.secondBestScore
    ? Math.max(0, before - moverWinPercent(input.secondBestScore, input.color))
    : undefined;
  const isEngineBest = input.playedMoveRank === 1;
  const isForced = input.legalMoveCount === 1;
  const isObviousRecapture = input.isObviousRecapture ?? false;
  const isTrivialCheckEscape = input.isTrivialCheckEscape ?? false;
  const playedMoveOutsideMultiPv = input.playedMoveOutsideMultiPv ?? false;
  const exclusions: string[] = [];

  if (isForced) exclusions.push("only-legal-move");
  if (isObviousRecapture) exclusions.push("obvious-recapture");
  if (isTrivialCheckEscape) exclusions.push("trivial-check-escape");
  if (before >= 97 || before <= 3) exclusions.push("position-already-decided");
  if (input.sacrifice && !input.sacrifice.genuine) exclusions.push("sacrifice-not-verified");

  const make = (classification: MoveClassification, precedenceRule: string): ClassificationResult => ({
    classification,
    reason: {
      precedenceRule,
      isEngineBest,
      ...(input.playedMoveRank === undefined ? {} : { engineRank: input.playedMoveRank }),
      ...(centipawnLoss === undefined ? {} : { centipawnLoss }),
      winPercentBefore: before,
      winPercentAfter: after,
      winPercentLoss: loss,
      ...(secondBestGapCp === undefined ? {} : { secondBestGapCp }),
      ...(secondBestGapWinPercent === undefined ? {} : { secondBestGapWinPercent }),
      legalMoveCount: input.legalMoveCount,
      isForced,
      isBook: input.isBook,
      isCheckmate: input.isCheckmate,
      isObviousRecapture,
      isTrivialCheckEscape,
      playedMoveOutsideMultiPv,
      ...(input.sacrifice === undefined ? {} : { sacrifice: input.sacrifice }),
      exclusions,
    },
  });

  if (input.isCheckmate) return make("best", "checkmate");

  if (hasForcedMateFor(input.scoreBefore, input.color) && !hasForcedMateFor(input.scoreAfter, input.color)) {
    return make("missed_mate", "missed-forced-mate");
  }

  if (before >= CLASSIFICATION_THRESHOLDS.missedWinChanceBefore && loss >= CLASSIFICATION_THRESHOLDS.missedWinDrop) {
    return make("missed_win", "missed-winning-position");
  }

  if (input.isBook && loss <= CLASSIFICATION_THRESHOLDS.bookMaxWinPercentLoss) {
    return make("book", "opening-book");
  }

  if (isForced) return make("forced", "only-legal-move");

  const brilliant = isEngineBest
    && loss <= CLASSIFICATION_THRESHOLDS.brilliantWinPercentLoss
    && input.sacrifice?.genuine === true
    && !isObviousRecapture
    && !isTrivialCheckEscape
    && before > 3
    && before < 97;
  if (brilliant) return make("brilliant", "verified-nontrivial-sacrifice");

  const criticalGap = (secondBestGapCp ?? 0) >= CLASSIFICATION_THRESHOLDS.greatSecondBestGapCp
    || (secondBestGapWinPercent ?? 0) >= CLASSIFICATION_THRESHOLDS.greatSecondBestGapWinPercent;
  if (isEngineBest && criticalGap && !isObviousRecapture && !isTrivialCheckEscape) {
    return make("great", "critical-best-move");
  }

  if (isEngineBest) return make("best", "engine-top-choice");

  if (centipawnLoss !== undefined) {
    if (centipawnLoss <= CLASSIFICATION_THRESHOLDS.excellentCpLoss) return make("excellent", "centipawn-loss-ladder");
    if (centipawnLoss <= CLASSIFICATION_THRESHOLDS.interestingCpLoss && (input.playedMoveRank ?? 99) > 2) {
      return make("interesting", "near-equal-novel-candidate");
    }
    if (centipawnLoss <= CLASSIFICATION_THRESHOLDS.goodCpLoss) return make("good", "centipawn-loss-ladder");
    if (centipawnLoss <= CLASSIFICATION_THRESHOLDS.inaccuracyCpLoss) return make("inaccuracy", "centipawn-loss-ladder");
    if (centipawnLoss <= CLASSIFICATION_THRESHOLDS.mistakeCpLoss) return make("mistake", "centipawn-loss-ladder");
  } else {
    if (loss <= 1) return make("excellent", "win-percent-loss-ladder");
    if (loss <= 3) return make("good", "win-percent-loss-ladder");
    if (loss <= 8) return make("inaccuracy", "win-percent-loss-ladder");
    if (loss <= 15) return make("mistake", "win-percent-loss-ladder");
  }

  if (loss >= CLASSIFICATION_THRESHOLDS.missDrop && input.hasTacticalBestLine) {
    return make("miss", "missed-tactical-resource");
  }
  return make("blunder", "centipawn-or-win-percent-loss-ladder");
}
