import type {
  HumanDifficultyAdjustment,
  HumanFindDifficulty,
  HumanFindDifficultyLabel,
} from "@chess-review/shared";

export interface HumanFindDifficultyInput {
  playedMoveProbability: number;
  legalMoveCount: number;
  secondBestGapCp?: number;
  secondBestGapWinPercent?: number;
  isEngineBest: boolean;
  isForced: boolean;
  isForcing: boolean;
  isSacrifice: boolean;
  tacticalMotifCount: number;
}

export const HUMAN_DIFFICULTY_THRESHOLDS = {
  naturalMax: 21,
  findableMax: 41,
  hardMax: 61,
  veryHardMax: 81,
  criticalGapCp: 150,
  criticalGapWinPercent: 10,
} as const;

function probabilityBase(probability: number): {
  score: number;
  band: HumanFindDifficulty["evidence"]["probabilityBand"];
} {
  if (probability >= 0.3) return { score: 12, band: "common" };
  if (probability >= 0.15) return { score: 30, band: "plausible" };
  if (probability >= 0.06) return { score: 50, band: "uncommon" };
  if (probability >= 0.02) return { score: 70, band: "rare" };
  return { score: 88, band: "very-rare" };
}

function labelForScore(score: number): HumanFindDifficultyLabel {
  if (score <= HUMAN_DIFFICULTY_THRESHOLDS.naturalMax) return "natural";
  if (score <= HUMAN_DIFFICULTY_THRESHOLDS.findableMax) return "findable";
  if (score <= HUMAN_DIFFICULTY_THRESHOLDS.hardMax) return "hard";
  if (score <= HUMAN_DIFFICULTY_THRESHOLDS.veryHardMax) return "very-hard";
  return "exceptional";
}

/**
 * Experimental, explainable heuristic for how likely a human is to find a move.
 * This is intentionally independent from objective move classification and Elo.
 */
export function humanFindDifficulty(input: HumanFindDifficultyInput): HumanFindDifficulty {
  if (!Number.isFinite(input.playedMoveProbability) || input.playedMoveProbability < 0 || input.playedMoveProbability > 1) {
    throw new RangeError("playedMoveProbability must be between 0 and 1");
  }
  if (!Number.isInteger(input.legalMoveCount) || input.legalMoveCount < 1) {
    throw new RangeError("legalMoveCount must be a positive integer");
  }
  if (!Number.isInteger(input.tacticalMotifCount) || input.tacticalMotifCount < 0) {
    throw new RangeError("tacticalMotifCount must be a non-negative integer");
  }

  const base = probabilityBase(input.playedMoveProbability);
  const adjustments: HumanDifficultyAdjustment[] = [];

  if (input.isForced) {
    adjustments.push({ factor: "only-legal-move", points: 5 - base.score });
  } else {
    const criticalGap = input.isEngineBest && (
      (input.secondBestGapCp ?? 0) >= HUMAN_DIFFICULTY_THRESHOLDS.criticalGapCp
      || (input.secondBestGapWinPercent ?? 0) >= HUMAN_DIFFICULTY_THRESHOLDS.criticalGapWinPercent
    );
    if (criticalGap) adjustments.push({ factor: "critical-objective-gap", points: 7 });
    if (input.legalMoveCount >= 30) adjustments.push({ factor: "many-legal-moves", points: 6 });
    else if (input.legalMoveCount <= 5) adjustments.push({ factor: "few-legal-moves", points: -6 });
    if (input.isForcing) adjustments.push({ factor: "forcing-move", points: -6 });
    if (input.isSacrifice) adjustments.push({ factor: "verified-sacrifice", points: 8 });
    if (input.tacticalMotifCount >= 2) adjustments.push({ factor: "multiple-tactical-motifs", points: 6 });
    else if (input.tacticalMotifCount === 1) adjustments.push({ factor: "tactical-motif", points: 3 });
  }

  const rawScore = base.score + adjustments.reduce((total, adjustment) => total + adjustment.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    label: labelForScore(score),
    score,
    evidence: {
      experimental: true,
      maiaProbability: input.playedMoveProbability,
      probabilityBand: base.band,
      legalMoveCount: input.legalMoveCount,
      ...(input.secondBestGapCp === undefined ? {} : { secondBestGapCp: input.secondBestGapCp }),
      ...(input.secondBestGapWinPercent === undefined ? {} : { secondBestGapWinPercent: input.secondBestGapWinPercent }),
      isEngineBest: input.isEngineBest,
      isForced: input.isForced,
      isForcing: input.isForcing,
      isSacrifice: input.isSacrifice,
      tacticalMotifCount: input.tacticalMotifCount,
      adjustments,
    },
  };
}
