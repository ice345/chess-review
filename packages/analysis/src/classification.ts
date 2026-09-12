import type {
  ClassificationReason,
  EngineConsistencyEvidence,
  EngineScore,
  MoveAnnotation,
  MoveClassification,
  MoveQuality,
  ObjectiveVerificationEvidence,
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
  sacrifice?: SacrificeEvidence;
  engineConsistency?: EngineConsistencyEvidence;
  verification?: ObjectiveVerificationEvidence;
  /** Final product builds may suppress consequential annotations until re-searched. */
  specialAnnotationsVerified?: boolean;
}

export interface ClassificationResult {
  quality: MoveQuality;
  annotations: MoveAnnotation[];
  /** Compatibility projection for existing icon/export consumers. */
  classification: MoveClassification;
  reason: ClassificationReason;
}

export const CLASSIFICATION_THRESHOLDS = {
  bestMaxWinPercentLoss: 0.5,
  excellentMaxWinPercentLoss: 2,
  goodMaxWinPercentLoss: 5,
  inaccuracyMaxWinPercentLoss: 10,
  mistakeMaxWinPercentLoss: 20,
  brilliantWinPercentLoss: 1,
  brilliantSecondBestGapWinPercent: 5,
  criticalSecondBestGapWinPercent: 10,
  bookMaxWinPercentLoss: 3,
  missedWinChanceBefore: 92,
  missedWinDrop: 30,
  /**
   * A move ordered below another by MultiPV still counts as the engine's best
   * choice when it is genuinely the same move-evaluation: both the
   * win-percentage loss AND the centipawn loss must be negligible.
   *
   * The centipawn half is essential. In a decided position WinPercent saturates,
   * so a move that is 100cp worse still reports zero win-percent loss; treating
   * that as a tie would label a real mistake "best". Rank alone is equally
   * wrong: two moves can share the top evaluation and only one can be rank 1.
   */
  engineBestTieWinPercent: 0.1,
  engineBestTieCentipawns: 5,
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
  // "Engine best" means no better move existed, not "MultiPV listed it first".
  // A genuine tie needs both a negligible win-percent loss and a negligible
  // centipawn loss; see the threshold comment for why both are required.
  const isEngineBest = input.playedMoveRank === 1
    || (loss <= CLASSIFICATION_THRESHOLDS.engineBestTieWinPercent
      && centipawnLoss !== undefined
      && centipawnLoss <= CLASSIFICATION_THRESHOLDS.engineBestTieCentipawns);
  const isForced = input.legalMoveCount === 1;
  const isObviousRecapture = input.isObviousRecapture ?? false;
  const isTrivialCheckEscape = input.isTrivialCheckEscape ?? false;
  const playedMoveOutsideMultiPv = input.playedMoveOutsideMultiPv ?? false;
  const exclusions: string[] = [];
  const annotations: MoveAnnotation[] = [];
  const retainConsequentialAnnotations = input.specialAnnotationsVerified !== false;

  if (isForced) exclusions.push("only-legal-move");
  if (isObviousRecapture) exclusions.push("obvious-recapture");
  if (isTrivialCheckEscape) exclusions.push("trivial-check-escape");
  if (before >= 97 || before <= 3) exclusions.push("position-already-decided");
  if (input.sacrifice && !input.sacrifice.genuine) exclusions.push("sacrifice-not-verified");

  const quality: MoveQuality = input.isCheckmate
    || (isEngineBest && loss <= CLASSIFICATION_THRESHOLDS.bestMaxWinPercentLoss)
    ? "best"
    : loss <= CLASSIFICATION_THRESHOLDS.excellentMaxWinPercentLoss
      ? "excellent"
      : loss <= CLASSIFICATION_THRESHOLDS.goodMaxWinPercentLoss
        ? "good"
        : loss <= CLASSIFICATION_THRESHOLDS.inaccuracyMaxWinPercentLoss
          ? "inaccuracy"
          : loss <= CLASSIFICATION_THRESHOLDS.mistakeMaxWinPercentLoss
            ? "mistake"
            : "blunder";
  const qualityRule = input.isCheckmate
    ? "checkmate"
    : quality === "best"
      ? "engine-top-choice-negligible-loss"
      : "win-percent-loss-ladder";

  const lostMate = hasForcedMateFor(input.scoreBefore, input.color)
    && !hasForcedMateFor(input.scoreAfter, input.color);
  const missedWin = before >= CLASSIFICATION_THRESHOLDS.missedWinChanceBefore
    && loss >= CLASSIFICATION_THRESHOLDS.missedWinDrop;
  if (!retainConsequentialAnnotations && (lostMate || missedWin)) exclusions.push("special-annotation-not-verified");
  if (lostMate && retainConsequentialAnnotations) annotations.push("missed_mate");
  else if (missedWin && retainConsequentialAnnotations) annotations.push("missed_win");
  if (input.isBook && loss <= CLASSIFICATION_THRESHOLDS.bookMaxWinPercentLoss) annotations.push("book");
  if (isForced) annotations.push("forced");
  if (input.sacrifice?.genuine === true) annotations.push("sacrifice");

  const outcomeRelevantGap = (secondBestGapWinPercent ?? 0)
    >= CLASSIFICATION_THRESHOLDS.criticalSecondBestGapWinPercent;
  const critical = isEngineBest
    && outcomeRelevantGap
    && !isForced
    && !isObviousRecapture
    && !isTrivialCheckEscape;
  if (critical && retainConsequentialAnnotations) annotations.push("critical");
  else if (critical) exclusions.push("special-annotation-not-verified");

  const brilliant = isEngineBest
    && loss <= CLASSIFICATION_THRESHOLDS.brilliantWinPercentLoss
    && (secondBestGapWinPercent ?? 0) >= CLASSIFICATION_THRESHOLDS.brilliantSecondBestGapWinPercent
    && input.sacrifice?.genuine === true
    && !isForced
    && !isObviousRecapture
    && !isTrivialCheckEscape
    && before > 3
    && before < 97;
  if (brilliant && retainConsequentialAnnotations) annotations.push("brilliant");
  else if (brilliant && !exclusions.includes("special-annotation-not-verified")) exclusions.push("special-annotation-not-verified");

  const classification: MoveClassification = annotations.includes("missed_mate")
    ? "missed_mate"
    : annotations.includes("missed_win")
      ? "missed_win"
      : annotations.includes("book")
        ? "book"
        : annotations.includes("forced")
          ? "forced"
          : annotations.includes("brilliant")
            ? "brilliant"
            : annotations.includes("critical")
              ? "great"
              : quality;
  const precedenceRule = annotations.includes("missed_mate")
    ? "missed-forced-mate"
    : annotations.includes("missed_win")
      ? "missed-winning-position"
      : annotations.includes("book")
        ? "opening-book"
        : annotations.includes("forced")
          ? "only-legal-move"
          : annotations.includes("brilliant")
            ? "verified-nontrivial-sacrifice"
            : annotations.includes("critical")
              ? "outcome-critical-best-move"
              : qualityRule;

  return {
    quality,
    annotations,
    classification,
    reason: {
      precedenceRule,
      qualityRule,
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
      ...(input.engineConsistency === undefined ? {} : { engineConsistency: input.engineConsistency }),
      ...(input.verification === undefined ? {} : { verification: input.verification }),
      ...(input.sacrifice === undefined ? {} : { sacrifice: input.sacrifice }),
      exclusions,
    },
  };
}
