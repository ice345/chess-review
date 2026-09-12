import { replayUciLine } from "@chess-review/chess-core";
import type {
  EngineScore,
  HumanAnalysis,
  HumanFindDifficulty,
  MoveAnalysisV2,
  PlayerColor,
} from "@chess-review/shared";
import { humanFindDifficulty } from "./human-difficulty";
import { scoreForColor } from "./score";
import { winPercentFromScore } from "./win-percent";

/**
 * Practice acceptance, not a replacement for objective move classification.
 *
 * Aligned with Lichess "Learn from your mistakes" (`lila`
 * `ui/analyse/src/retrospect/retroCtrl.ts`), which accepts an answer when its
 * winning-chance loss against the position before the mistake is at most four
 * percentage points (`diff > -0.04`). Their threshold is deliberately more
 * forgiving than the objective Excellent band, because this is a teaching
 * exercise and several moves usually keep the position.
 */
export const PRACTICE_MAX_WIN_PERCENT_LOSS = 4;

/**
 * The plies worth practising for one color.
 *
 * Selection differs from Lichess's `evalSwings` in how it detects a fault:
 * Lichess looks for an evaluation swing above ten percentage points, while this
 * project reuses the canonical V2 quality ladder, whose mistake and blunder
 * bands start at the same ten points. The resulting sets largely coincide, and
 * we get classification evidence for free.
 *
 * The theory exception mirrors Lichess's masters-opening check: a move inside
 * recognised theory is skipped, because the opening has many playable moves and
 * punishing a normal developing move teaches nothing. Lichess asks the masters
 * database; we use the canonical theory boundary this project already computes,
 * which is a position-based approximation rather than game-frequency evidence.
 */
export type PracticeExclusionReason = "opening-theory" | "missing-engine-evidence";

export interface PracticeQueue<T> {
  eligible: T[];
  excluded: Array<{ move: T; reason: PracticeExclusionReason }>;
}

type PracticeMove = Pick<MoveAnalysisV2, "color" | "quality" | "annotations" | "stockfish" | "fenBefore" | "uci"> & {
  classificationReason: { isBook: boolean };
};

function isPracticeFault(move: PracticeMove, includeInaccuracies: boolean): boolean {
  return ["mistake", "blunder"].includes(move.quality)
    || (includeInaccuracies && move.quality === "inaccuracy")
    || move.annotations.includes("missed_win")
    || move.annotations.includes("missed_mate");
}

function hasUsableEngineAlternative(move: PracticeMove): boolean {
  const best = move.stockfish.bestMove;
  if (move.stockfish.fen !== move.fenBefore || !best || best === move.uci) return false;
  try { return replayUciLine(move.fenBefore, [best]).length === 1; } catch { return false; }
}

export function practiceQueue<T extends PracticeMove>(
  moves: readonly T[],
  color: PlayerColor,
  includeInaccuracies = false,
): PracticeQueue<T> {
  const eligible: T[] = [];
  const excluded: Array<{ move: T; reason: PracticeExclusionReason }> = [];
  for (const move of moves) {
    if (move.color !== color || !isPracticeFault(move, includeInaccuracies)) continue;
    if (move.classificationReason.isBook) {
      excluded.push({ move, reason: "opening-theory" });
      continue;
    }
    if (!hasUsableEngineAlternative(move)) {
      excluded.push({ move, reason: "missing-engine-evidence" });
      continue;
    }
    eligible.push(move);
  }
  return { eligible, excluded };
}

export function practiceMoves<T extends PracticeMove>(
  moves: readonly T[],
  color: PlayerColor,
  includeInaccuracies = false,
): T[] {
  return practiceQueue(moves, color, includeInaccuracies).eligible;
}


export function judgePracticeScore(best: EngineScore, candidate: EngineScore, color: PlayerColor): { accepted: boolean; loss: number; reason: "near-best" | "lost-mate" | "allows-mate" | "too-costly" } {
  const root = scoreForColor(best, color), answer = scoreForColor(candidate, color);
  const loss = Math.max(0, winPercentFromScore(root) - winPercentFromScore(answer));
  // Saturated WinPercent is insufficient to distinguish a forced mate from
  // a large cp advantage. Preserve the actual mate outcome explicitly.
  if (root.kind === "mate" && root.mateIn > 0 && !(answer.kind === "mate" && answer.mateIn > 0)) return { accepted: false, loss, reason: "lost-mate" };
  if (answer.kind === "mate" && answer.mateIn < 0 && !(root.kind === "mate" && root.mateIn < 0)) return { accepted: false, loss, reason: "allows-mate" };
  const accepted = loss <= PRACTICE_MAX_WIN_PERCENT_LOSS;
  return { accepted, loss, reason: accepted ? "near-best" : "too-costly" };
}

export interface PracticeHumanComparison {
  targetElo: number;
  model: string;
  /** How often players at this level choose the move that was actually played. */
  playedMoveProbability: number;
  playedMovePolicyRank: number;
  /** Present only when Maia evaluated the engine's move; absent otherwise. */
  bestMoveProbability?: number;
  bestMovePolicyRank?: number;
  /**
   * Difficulty of finding the engine's move, from the existing heuristic. Absent
   * when Maia has no entry for that move: the heuristic would otherwise receive a
   * placeholder zero and report "exceptional" for a move nobody evaluated.
   */
  bestMoveDifficulty?: HumanFindDifficulty;
  /** True when the mistake was the popular choice, which is the teachable case. */
  playedMoveWasNatural: boolean;
  summary: string;
}

/**
 * A probability as text that never lies about small values. Rounding 0.4% to
 * "0%" would read as "never played", which is different from "rarely played".
 */
function percentText(probability: number): string {
  if (probability <= 0) return "0%";
  if (probability < 0.01) return "<1%";
  return `${Math.round(probability * 100)}%`;
}

/**
 * Explains a mistake through human behaviour instead of engine truth: the move
 * that was played may have been the most popular choice at that level, while the
 * engine's move was rare. This is the project's own addition to the shared
 * attempt/solution flow — Lichess's retrospect shows no human-model evidence at
 * all — and it stays canonical: probabilities come from Maia and the difficulty
 * label reuses `humanFindDifficulty`, so no language model is involved.
 *
 * The played move's probability and policy rank are read from the dedicated
 * fields rather than from `candidates`. Maia's move review only returns its top
 * `multiPv` policy moves as candidates, so the move that was actually played —
 * precisely the one this feature exists to explain — is usually absent from that
 * list: a blunder is a move humans rarely pick. Looking it up in `candidates`
 * would silently disable the explanation in exactly the case it is for, and
 * reporting a missing engine-best entry as "0%" would invent a number.
 *
 * Requires Maia, which exists only in Enhanced Local mode. Callers must keep the
 * practice flow complete without it.
 */
export function practiceHumanComparison(input: {
  human: Pick<HumanAnalysis, "model" | "targetElo" | "playedMoveProbability" | "playedMoveRank" | "candidates">;
  bestMove: string;
  legalMoveCount: number;
  isForced: boolean;
  isForcing: boolean;
  isSacrifice: boolean;
  isEngineBest: boolean;
  secondBestGapCp?: number;
  secondBestGapWinPercent?: number;
  tacticalMotifCount: number;
}): PracticeHumanComparison {
  const best = input.human.candidates.find((candidate) => candidate.uci === input.bestMove);
  // Only computed when the probability is real; see the field comment.
  const difficulty = best === undefined ? undefined : humanFindDifficulty({
    playedMoveProbability: best.probability,
    legalMoveCount: input.legalMoveCount,
    ...(input.secondBestGapCp === undefined ? {} : { secondBestGapCp: input.secondBestGapCp }),
    ...(input.secondBestGapWinPercent === undefined ? {} : { secondBestGapWinPercent: input.secondBestGapWinPercent }),
    isEngineBest: input.isEngineBest,
    isForced: input.isForced,
    isForcing: input.isForcing,
    isSacrifice: input.isSacrifice,
    tacticalMotifCount: input.tacticalMotifCount,
  });
  const playedPct = percentText(input.human.playedMoveProbability);
  // "Natural" is a comparison, so it needs both numbers. With no Maia entry for
  // the engine's move there is nothing to compare, and claiming the played move
  // was the natural one would be an unsupported conclusion.
  const natural = best !== undefined && input.human.playedMoveProbability > best.probability;
  const bestClause = best === undefined
    ? "Maia did not evaluate the stronger move at this level."
    : `the stronger move is chosen ${percentText(best.probability)} of the time.`;
  return {
    targetElo: input.human.targetElo,
    model: input.human.model,
    playedMoveProbability: input.human.playedMoveProbability,
    playedMovePolicyRank: input.human.playedMoveRank,
    ...(best === undefined ? {} : { bestMoveProbability: best.probability, bestMovePolicyRank: best.policyRank }),
    ...(difficulty === undefined ? {} : { bestMoveDifficulty: difficulty }),
    playedMoveWasNatural: natural,
    // Both branches name the rank exactly once; the two clauses are joined with a
    // period so a missing comparison does not read as a comma-spliced run-on.
    summary: natural
      ? `At ${input.human.targetElo}, ${playedPct} of players choose the move you played (Maia rank #${input.human.playedMoveRank}), while ${bestClause} The natural move was the wrong one.`
      : `At ${input.human.targetElo}, you played a move chosen ${playedPct} of the time (Maia rank #${input.human.playedMoveRank}). ${bestClause}`,
  };
}
