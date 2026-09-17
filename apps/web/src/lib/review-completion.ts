import type {
  GameAnalysisV2,
  GamePhase,
  MoveAnalysisV2,
  MoveAnnotation,
  MoveClassification,
  MoveQuality,
  PlayerColor,
} from "@chess-review/shared";

/**
 * Facts for the end-of-review state.
 *
 * Every value is read from the canonical analysis — nothing here invents a chess
 * claim, and nothing waits on a coach response. The summary exists so the review
 * has an end and so the next learning step is obvious.
 *
 * Two selection rules live here rather than in the React tree, because "which
 * move is this review's highlight" and "which move was the mistake that mattered"
 * are teaching decisions that must be reproducible and testable.
 */

/** Who the summary is about. `both` states the mover on every fact. */
export type CompletionScope = PlayerColor | "both";

export interface CompletionMoment {
  ply: number;
  san: string;
  fenBefore: string;
  color: PlayerColor;
  classification: MoveClassification;
  quality: MoveQuality;
  annotations: readonly MoveAnnotation[];
  /** Mover win-percentage loss recorded by the canonical classification. */
  loss: number;
  accuracy: number;
}

export interface ReviewCompletionFacts {
  keyMomentCount: number;
  scope: CompletionScope;
  /** The mistake the learner lost the most winning chances to. */
  mostImportantMistake: CompletionMoment | null;
  /** The good move worth looking at again, chosen by the rule below. */
  highlight: CompletionMoment | null;
  /** One factual sentence, or null when the analysis cannot support one. */
  lesson: string | null;
}

/** Phases that were scored at all. The opening is always present. */
const PHASES: readonly GamePhase[] = ["opening", "middlegame", "endgame"];

/** Classifications that can carry a highlight. */
const HIGHLIGHT_CLASSIFICATIONS: readonly MoveClassification[] = ["brilliant", "great", "best"];

/** Ordinary quality bands that make a move an error regardless of its annotations. */
const COSTLY_QUALITIES: readonly MoveQuality[] = ["inaccuracy", "mistake", "blunder"];

/** Missing an available win or mate is an error even when the move kept a good quality. */
const COSTLY_ANNOTATIONS: readonly MoveAnnotation[] = ["missed_win", "missed_mate"];

function moment(move: MoveAnalysisV2): CompletionMoment {
  return {
    ply: move.ply,
    san: move.san,
    fenBefore: move.fenBefore,
    color: move.color,
    classification: move.classification,
    quality: move.quality,
    annotations: [...move.annotations],
    loss: move.classificationReason.winPercentLoss,
    accuracy: move.accuracy,
  };
}

/**
 * Highlight evidence tier, lowest first.
 *
 * A verified special good move outranks a critical-only move, and both outrank an
 * ordinary high-quality move. Accuracy alone would let three ordinary Best moves
 * outrank the one Brilliant the game actually contains, which is what selecting
 * by maximum Accuracy did.
 */
function highlightTier(move: MoveAnalysisV2): number {
  if (move.annotations.includes("brilliant")) return 0;
  if (move.annotations.includes("critical")) return 1;
  if (move.annotations.includes("sacrifice")) return 2;
  return 3;
}

export function buildReviewCompletion(analysis: GameAnalysisV2, player: PlayerColor | null): ReviewCompletionFacts {
  const scope: CompletionScope = player ?? "both";
  const inScope = (move: MoveAnalysisV2) => scope === "both" || move.color === scope;

  // The mistake that cost the most winning chances, by canonical loss and quality
  // evidence. A tiny loss on a move the analysis still called good — a critical
  // choice, for instance — is not a mistake at all. Moves arrive in ascending ply,
  // so a strict comparison keeps the earlier move on a tie.
  const worst = analysis.moves
    .filter((move) => inScope(move)
      && move.classificationReason.winPercentLoss > 0
      && (COSTLY_QUALITIES.includes(move.quality) || move.annotations.some((annotation) => COSTLY_ANNOTATIONS.includes(annotation))))
    .reduce<MoveAnalysisV2 | null>((current, move) => (
      current === null || move.classificationReason.winPercentLoss > current.classificationReason.winPercentLoss ? move : current
    ), null);

  // Teaching selection for the good move: evidence tier first, then Accuracy. The
  // earlier ply wins any remaining tie because moves arrive in ascending order.
  const highlight = analysis.moves
    .filter((move) => inScope(move) && HIGHLIGHT_CLASSIFICATIONS.includes(move.classification))
    .reduce<MoveAnalysisV2 | null>((current, move) => {
      if (current === null) return move;
      const tier = highlightTier(move);
      const currentTier = highlightTier(current);
      if (tier !== currentTier) return tier < currentTier ? move : current;
      return move.accuracy > current.accuracy ? move : current;
    }, null);

  return {
    keyMomentCount: analysis.criticalMoments.length,
    scope,
    mostImportantMistake: worst ? moment(worst) : null,
    highlight: highlight ? moment(highlight) : null,
    lesson: phaseLesson(analysis, player),
  };
}

/**
 * The lowest-scoring scored phase, stated as a fact.
 *
 * A phase is only named when the divider actually split the game, so an
 * opening-only game does not produce "your weakest phase was the opening". With a
 * known learner the sentence is theirs; without one it names the side, because an
 * anonymous review must not turn either player into "you".
 */
function phaseLesson(analysis: GameAnalysisV2, player: PlayerColor | null): string | null {
  if (analysis.division.middlePly === undefined) return null;
  const scored = (color: PlayerColor) => PHASES.flatMap((phase) => {
    const value = (color === "white" ? analysis.white : analysis.black).phaseAccuracy[phase];
    return value === undefined ? [] : [{ phase, value }];
  });
  if (player !== null) {
    const phases = scored(player);
    if (phases.length < 2) return null;
    const weakest = phases.reduce((lowest, entry) => (entry.value < lowest.value ? entry : lowest));
    return `${phaseLabel(weakest.phase)} was the lowest-scoring phase: ${player === "white" ? "White" : "Black"} Accuracy ${weakest.value.toFixed(1)}.`;
  }
  const sides = (["white", "black"] as const).flatMap((color) => scored(color).map((entry) => ({ color, ...entry })));
  if (sides.length < 2) return null;
  const weakest = sides.reduce((lowest, entry) => (entry.value < lowest.value ? entry : lowest));
  return `${weakest.color === "white" ? "White" : "Black"}'s ${phaseLabel(weakest.phase).toLowerCase()} was the lowest-scoring phase in this game: Accuracy ${weakest.value.toFixed(1)}.`;
}

function phaseLabel(phase: GamePhase): string {
  return phase === "middlegame" ? "Middlegame" : phase === "endgame" ? "Endgame" : "Opening";
}
