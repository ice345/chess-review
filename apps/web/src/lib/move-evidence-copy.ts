import type { ClassificationReason, MoveAnalysisV2, MoveAnnotation } from "@chess-review/shared";
import { ANNOTATION_LABEL } from "./move-quality-label";

/**
 * Plain-language sentences for a move's canonical evidence.
 *
 * These are mappings from recorded facts, never inferences: a Blunder proves a
 * large loss, not which tactic was missed, so the sentence that states the loss
 * also states that this build does not name a cause. Nothing here reads a score
 * and invents a motive.
 */

type Evidence = Pick<MoveAnalysisV2, "classification" | "quality" | "annotations"> & {
  classificationReason: Pick<
    ClassificationReason,
    "winPercentLoss" | "winPercentBefore" | "winPercentAfter" | "engineRank" | "secondBestGapWinPercent" | "isForced" | "verification" | "sacrifice" | "exclusions"
  >;
};

const COSTLY_ANNOTATIONS: readonly MoveAnnotation[] = ["missed_win", "missed_mate"];

/** The one sentence that explains this move's label. */
export function moveEvidenceSentence(move: Evidence): string {
  const annotations = move.annotations;
  const loss = move.classificationReason.winPercentLoss;
  if (annotations.includes("missed_mate")) return "A forced mate was available here and this move let it go.";
  if (annotations.includes("missed_win")) return "A winning continuation was available here and this move let it go.";
  if (annotations.includes("brilliant")) return "This investing move is the engine's first choice: the material it gives survives the opponent's best answer.";
  if (annotations.includes("critical")) {
    const gap = move.classificationReason.secondBestGapWinPercent;
    return gap === undefined
      ? "This was the only reasonable choice; the alternatives were substantially worse."
      : `This was the only reasonable choice: the next-best move was ${gap.toFixed(1)} win-percentage points worse.`;
  }
  if (annotations.includes("sacrifice")) return "It gives material away on purpose, and the engine's reply shows the compensation.";
  if (annotations.includes("book")) return "Known opening theory rather than an independent decision.";
  if (annotations.includes("forced") || move.classificationReason.isForced) return "The position left nothing to choose here; this move was forced.";
  if (loss <= 0.5) return "It holds the engine's evaluation: the winning chances do not move.";

  const cost = `It gave up ${loss.toFixed(1)} win-percentage points of winning chances.`;
  const costly = ["inaccuracy", "mistake", "blunder"].includes(move.quality) || annotations.some((annotation) => COSTLY_ANNOTATIONS.includes(annotation));
  // The cost is measured; the cause is not. Saying so is the honest version of a
  // tactical explanation this build cannot produce.
  return costly ? `${cost} The analysis records the cost, not which idea was missed.` : cost;
}

/**
 * A caveat for a strong label that rests on the baseline search alone.
 *
 * The classification pipeline re-searches a bounded selection of moves at a higher
 * depth. A move outside that selection keeps its depth-10 classification, and in a
 * sharp position that depth can rank the objectively best move third. Saying so is
 * the honest version of a confident label: the number is real, the search behind it
 * is finite. Calibrated by the C01 investigation
 * (`docs/audits/2026-09-15-c01-opera-evaluation-investigation.md`).
 */
export function baselineOnlyCaveat(move: Evidence): string | null {
  const consequential = ["mistake", "blunder"].includes(move.quality)
    || move.annotations.some((annotation) => ["brilliant", "critical", "missed_win", "missed_mate"].includes(annotation));
  if (!consequential) return null;
  const verification = move.classificationReason.verification;
  if (verification?.status === "verified") return null;
  // The depth is only named when the evidence recorded one. Building the phrase
  // first keeps the sentence readable either way: substituting into a fixed
  // template left "baseline depth- search" behind when the depth was absent.
  const searchPhrase = verification?.depth === undefined ? "baseline search" : `baseline depth-${verification.depth} search`;
  return `This label comes from the ${searchPhrase} and this move was not re-searched at the verification depth, so it can be depth-sensitive.`;
}

/** How the played move compared with the engine's own ordering. */
export function engineChoiceLabel(reason: Pick<ClassificationReason, "engineRank">): string {
  if (reason.engineRank === 1) return "The engine's first choice";
  if (reason.engineRank === undefined) return "Outside the engine's top candidates; scored with a restricted search of this move";
  return `Engine candidate #${reason.engineRank}`;
}

/** What the search behind this move actually did. */
export function verificationLabel(move: { stockfish: { depth: number }; classificationReason: Pick<ClassificationReason, "verification"> }): string {
  const verification = move.classificationReason.verification;
  if (verification === undefined) return `Baseline search at depth ${move.stockfish.depth}`;
  return verification.status === "verified"
    ? `Re-searched at depth ${verification.depth} with MultiPV ${verification.multiPv}`
    : `Baseline search at depth ${verification.depth}; this move was not re-searched`;
}

/** The winning chances the move was judged on, as the classification recorded them. */
export function winningChancesLabel(reason: Pick<ClassificationReason, "winPercentBefore" | "winPercentAfter" | "winPercentLoss">): string {
  return `${reason.winPercentBefore.toFixed(1)}% → ${reason.winPercentAfter.toFixed(1)}% for the mover (${reason.winPercentLoss.toFixed(1)} lost)`;
}

/** Sacrifice evidence, only when the detector actually recorded one. */
export function sacrificeLabel(reason: Pick<ClassificationReason, "sacrifice">): string | null {
  const sacrifice = reason.sacrifice;
  if (sacrifice === undefined) return null;
  return sacrifice.genuine
    ? `Genuine investment of ${sacrifice.sacrificedMaterial} centipawns; exchange value ${sacrifice.see}; compensation ${sacrifice.compensationCp}`
    : `Material was offered but the exchange value ${sacrifice.see} shows it comes straight back`;
}

/** The annotation names as they are shown elsewhere in the product. */
export function annotationsLabel(annotations: readonly MoveAnnotation[]): string {
  return annotations.map((annotation) => ANNOTATION_LABEL[annotation]).join(", ");
}
