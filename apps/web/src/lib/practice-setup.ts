import { practiceQueue } from "@chess-review/analysis";
import type { GameAnalysisV2, PlayerColor } from "@chess-review/shared";

/**
 * The Practice setup, derived once so the panel never recomputes practice
 * eligibility for itself. Counts come from the canonical
 * `practiceQueue(...).eligible`; this module only decides which side is
 * selected and what the setup can say about each side.
 *
 * The structure is deliberately total: both sides always exist, so selecting a
 * side can never remove the selector. A count of 0 is an ordinary state, not an
 * error, and an empty side stays selectable so its explanation is reachable.
 */
export interface PracticeSideSetup {
  color: PlayerColor;
  /** Positions this side can practise under the current filter. */
  count: number;
  /** Faults that exist but are excluded, so the empty state can say why. */
  excluded: { openingTheory: number; missingEngineEvidence: number };
}

export interface PracticeSetup {
  /** White then Black, always both. */
  sides: [PracticeSideSetup, PracticeSideSetup];
  selected: PlayerColor;
  /** The selected side; practice always starts this one. */
  startable: PracticeSideSetup;
}

export function practiceSideName(color: PlayerColor): string {
  return color === "white" ? "White" : "Black";
}

function sideSetup(analysis: GameAnalysisV2, color: PlayerColor, includeInaccuracies: boolean): PracticeSideSetup {
  const queue = practiceQueue(analysis.moves, color, includeInaccuracies);
  return {
    color,
    count: queue.eligible.length,
    excluded: {
      openingTheory: queue.excluded.filter((item) => item.reason === "opening-theory").length,
      missingEngineEvidence: queue.excluded.filter((item) => item.reason === "missing-engine-evidence").length,
    },
  };
}

/**
 * The side to preselect when nothing has been chosen and no learner is known:
 * the side with more to practise, White on a tie.
 *
 * It reads the unfiltered queue on purpose. Deriving it from the filtered
 * counts would let "Include inaccuracies" move the highlight from under the
 * visitor, and the selected side must stay coherent across a filter change.
 */
function sideWithPractice(analysis: GameAnalysisV2): PlayerColor {
  const count = (color: PlayerColor) => practiceQueue(analysis.moves, color, false).eligible.length;
  return count("black") > count("white") ? "black" : "white";
}

export function practiceSetup(input: {
  analysis: GameAnalysisV2;
  includeInaccuracies: boolean;
  /** What the visitor chose in this review session, or null while untouched. */
  selected: PlayerColor | null;
  /** The learner's colour when the game came from a linked account. */
  knownColor: PlayerColor | null;
}): PracticeSetup {
  const white = sideSetup(input.analysis, "white", input.includeInaccuracies);
  const black = sideSetup(input.analysis, "black", input.includeInaccuracies);
  const selected = input.selected ?? input.knownColor ?? sideWithPractice(input.analysis);
  return {
    sides: [white, black],
    selected,
    startable: selected === "white" ? white : black,
  };
}

/** Why a side has nothing to practise, in the visitor's terms. */
export function practiceEmptyCopy(side: PracticeSideSetup): string {
  const name = practiceSideName(side.color);
  const theory = side.excluded.openingTheory;
  const evidence = side.excluded.missingEngineEvidence;
  if (theory === 0 && evidence === 0) {
    return `No mistakes were recorded for ${name}.`;
  }
  if (theory > 0 && evidence === 0) {
    return `${theory} ${theory === 1 ? "fault" : "faults"} for ${name} stayed inside recognised opening theory, so there is nothing to practise.`;
  }
  if (evidence > 0 && theory === 0) {
    return `Engine evidence is not ready for ${name}'s faults yet. Re-analyse the game, or try the other side.`;
  }
  return `${theory} opening-theory ${theory === 1 ? "fault" : "faults"} and ${evidence} without usable engine evidence were excluded for ${name}.`;
}
