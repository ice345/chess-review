import { winPercentFromScore } from "@chess-review/analysis";
import type { EngineScore } from "@chess-review/shared";

export type BoardOrientation = "white" | "black";

export interface EvaluationBarPresentation {
  whitePercent: number;
  blackPercent: number;
  topColor: BoardOrientation;
  topPercent: number;
  bottomColor: BoardOrientation;
  bottomPercent: number;
}

/**
 * Converts canonical White-POV engine truth into orientation-only presentation.
 * The score conversion deliberately remains owned by packages/analysis.
 */
export function evaluationBarPresentation(
  score: EngineScore | null,
  orientation: BoardOrientation,
): EvaluationBarPresentation {
  const whitePercent = score === null ? 50 : winPercentFromScore(score);
  const blackPercent = 100 - whitePercent;
  const whiteAtBottom = orientation === "white";

  return {
    whitePercent,
    blackPercent,
    topColor: whiteAtBottom ? "black" : "white",
    topPercent: whiteAtBottom ? blackPercent : whitePercent,
    bottomColor: whiteAtBottom ? "white" : "black",
    bottomPercent: whiteAtBottom ? whitePercent : blackPercent,
  };
}
