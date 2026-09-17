import type { MoveAnalysisV2, MoveAnnotation } from "@chess-review/shared";
import { classificationForAnnotation, QUALITY_META } from "@chess-review/ui";

export const ANNOTATION_ORDER: MoveAnnotation[] = ["brilliant", "critical", "book", "forced", "sacrifice", "missed_win", "missed_mate"];
export const ANNOTATION_LABEL: Record<MoveAnnotation, string> = {
  brilliant: "Brilliant",
  critical: "Critical",
  book: "Book",
  forced: "Forced",
  sacrifice: "Sacrifice",
  missed_win: "Missed win",
  missed_mate: "Missed mate",
};

export function displayedMoveQualityLabel(move: Pick<MoveAnalysisV2, "classification">): string {
  return QUALITY_META[move.classification].label;
}

/** Annotations whose V3 silhouette is not already the row's classification icon. */
export function extraMoveAnnotations(move: Pick<MoveAnalysisV2, "classification"> & { readonly annotations: readonly MoveAnnotation[] }): MoveAnnotation[] {
  return move.annotations.filter((annotation) => classificationForAnnotation(annotation) !== move.classification);
}
