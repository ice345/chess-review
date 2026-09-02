import type { MoveAnalysisV2, MoveAnnotation } from "@chess-review/shared";
import { QUALITY_META } from "@chess-review/ui";

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
