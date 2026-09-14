import type { GameAnalysisV2, GamePhase, MoveAnalysisV2, MoveClassification, PlayerColor } from "@chess-review/shared";

/**
 * Facts for the end-of-review state.
 *
 * Every value is read from the canonical analysis — nothing here invents a chess
 * claim, and nothing waits on a coach response. The summary exists so the review
 * has an end and so the next learning step is obvious.
 */

export interface CompletionMoment {
  ply: number;
  san: string;
  fenBefore: string;
  color: PlayerColor;
  classification: MoveClassification;
  /** WinPercent given up by the move; only meaningful for the mistake list. */
  swing: number;
  accuracy: number;
}

export interface ReviewCompletionFacts {
  keyMomentCount: number;
  mostImportantMistake: CompletionMoment | null;
  bestMoment: CompletionMoment | null;
  /** One factual sentence, or null when the analysis cannot support one. */
  lesson: string | null;
}

/** Phases that were scored at all. The opening is always present. */
const PHASES: readonly GamePhase[] = ["opening", "middlegame", "endgame"];

const BEST_CLASSIFICATIONS: readonly MoveClassification[] = ["brilliant", "great", "best"];

function moment(move: MoveAnalysisV2, swing: number): CompletionMoment {
  return {
    ply: move.ply,
    san: move.san,
    fenBefore: move.fenBefore,
    color: move.color,
    classification: move.classification,
    swing,
    accuracy: move.accuracy,
  };
}

export function buildReviewCompletion(analysis: GameAnalysisV2, player: PlayerColor | null): ReviewCompletionFacts {
  const moments = analysis.criticalMoments
    .flatMap((critical) => {
      const move = analysis.moves[critical.ply - 1];
      return move ? [{ critical, move }] : [];
    });

  // The biggest evaluation swing is the mistake that mattered most.
  const worst = moments
    .filter(({ critical }) => critical.winPercentSwing > 0)
    .reduce<{ critical: GameAnalysisV2["criticalMoments"][number]; move: MoveAnalysisV2 } | null>(
      (best, entry) => (best === null || entry.critical.winPercentSwing > best.critical.winPercentSwing ? entry : best),
      null,
    );

  // The best move actually played, by canonical Accuracy among best-classified moves.
  const best = analysis.moves
    .filter((move) => BEST_CLASSIFICATIONS.includes(move.classification))
    .reduce<MoveAnalysisV2 | null>((current, move) => (current === null || move.accuracy > current.accuracy ? move : current), null);

  return {
    keyMomentCount: analysis.criticalMoments.length,
    mostImportantMistake: worst ? moment(worst.move, worst.critical.winPercentSwing) : null,
    bestMoment: best ? moment(best, 0) : null,
    lesson: phaseLesson(analysis, player),
  };
}

/**
 * The visitor's weakest scored phase, stated as a fact.
 *
 * A phase is only named when the divider actually split the game, so an
 * opening-only game does not produce "your weakest phase was the opening".
 */
function phaseLesson(analysis: GameAnalysisV2, player: PlayerColor | null): string | null {
  if (!player || analysis.division.middlePly === undefined) return null;
  const accuracy = player === "white" ? analysis.white.phaseAccuracy : analysis.black.phaseAccuracy;
  const scored = PHASES.flatMap((phase) => {
    const value = accuracy[phase];
    return value === undefined ? [] : [{ phase, value }];
  });
  if (scored.length < 2) return null;
  const weakest = scored.reduce((lowest, entry) => (entry.value < lowest.value ? entry : lowest));
  const label = weakest.phase === "middlegame" ? "Middlegame" : weakest.phase === "endgame" ? "Endgame" : "Opening";
  return `${label} was the lowest-scoring phase: ${player === "white" ? "White" : "Black"} Accuracy ${weakest.value.toFixed(1)}.`;
}
