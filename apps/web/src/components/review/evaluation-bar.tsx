import type { EngineScore } from "@chess-review/shared";
import { evaluationBarPresentation, type BoardOrientation } from "../../lib/evaluation-bar";
import { formatEngineScore } from "../../lib/review-format";

export function EvaluationBar({
  score,
  orientation,
}: {
  score: EngineScore | null;
  orientation: BoardOrientation;
}) {
  const presentation = evaluationBarPresentation(score, orientation);

  return (
    <div
      className={`eval-bar eval-bottom-${presentation.bottomColor}`}
      aria-label={`White winning chances ${Math.round(presentation.whitePercent)} percent; ${presentation.bottomColor} at bottom`}
    >
      <div
        className={`eval-top eval-${presentation.topColor}`}
        style={{ height: `${presentation.topPercent}%` }}
      />
      <span>{formatEngineScore(score)}</span>
    </div>
  );
}
