import type { EngineScore, MaiaPositionAnalysis } from "@chess-review/shared";
import {
  evaluationBarPresentation,
  type BoardOrientation,
  type EvaluationMode,
} from "../../lib/evaluation-bar";
import { formatEngineScore } from "../../lib/review-format";

function percent(value: number): string {
  return String(Math.round(value));
}

export function EvaluationBar({
  mode,
  stockfish,
  maia,
  orientation,
}: {
  mode: EvaluationMode;
  stockfish: EngineScore | null;
  maia: MaiaPositionAnalysis | null;
  orientation: BoardOrientation;
}) {
  const presentation = evaluationBarPresentation({ mode, stockfish, maia }, orientation);
  const maiaLabel = presentation.maia
    ? "W" + percent(presentation.maia.whiteWinPercent)
      + " D" + percent(presentation.maia.drawPercent)
      + " L" + percent(presentation.maia.blackWinPercent)
    : "—";

  return (
    <div
      className={"eval-bar eval-source-" + mode + " eval-bottom-" + presentation.bottomColor}
      aria-label={presentation.ariaLabel}
      title={presentation.sourceLabel}
    >
      <div
        className={"eval-top eval-" + presentation.topColor}
        style={{ height: presentation.topPercent + "%" }}
      />
      {mode === "compare" && presentation.maia && (
        <i
          className="eval-maia-marker"
          style={{ top: presentation.maia.markerTopPercent + "%" }}
          aria-hidden="true"
        />
      )}
      <span>
        {mode === "maia" ? maiaLabel : formatEngineScore(stockfish)}
      </span>
      <small>{mode === "stockfish" ? "SF" : mode === "maia" ? "H-WDL" : "SF + H"}</small>
    </div>
  );
}
