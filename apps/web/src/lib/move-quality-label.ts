import type { MoveAnalysisV2, MoveAnnotation, UiLanguage } from "@chess-review/shared";
import { classificationForAnnotation, qualityLabel } from "@chess-review/ui";

/** Display order for the annotations a move can carry. */
export const ANNOTATION_ORDER: MoveAnnotation[] = ["brilliant", "critical", "book", "forced", "sacrifice", "missed_win", "missed_mate"];

/**
 * The name of the move's quality, in the interface language.
 *
 * The names themselves live in `@chess-review/ui` alongside the marks, because the
 * board badge, the move list and the export all have to agree on them.
 */
export function displayedMoveQualityLabel(move: Pick<MoveAnalysisV2, "classification">, language: UiLanguage): string {
  return qualityLabel(move.classification, language);
}

/** Annotations whose V3 silhouette is not already the row's classification icon. */
export function extraMoveAnnotations(move: Pick<MoveAnalysisV2, "classification"> & { readonly annotations: readonly MoveAnnotation[] }): MoveAnnotation[] {
  return move.annotations.filter((annotation) => classificationForAnnotation(annotation) !== move.classification);
}
