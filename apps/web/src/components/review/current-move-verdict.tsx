"use client";

import Link from "next/link";
import { formatMoveNotation, type MoveAnalysisV2 } from "@chess-review/shared";
import {
  HUMAN_DIFFICULTY_META,
  QualityIcon,
} from "@chess-review/ui";
import { useReviewRuntime } from "../review-runtime";
import { displayedMoveQualityLabel } from "../../lib/move-quality-label";
import { formatEngineScore } from "../../lib/review-format";

function percentage(value: number): string {
  return (value * 100).toFixed(value < 0.1 ? 1 : 0) + "%";
}

function modelLabel(model: string): string {
  return model.replace("maia3-", "Maia-3 ").toUpperCase();
}

export function CurrentMoveVerdict({ move }: { move: MoveAnalysisV2 }) {
  const runtime = useReviewRuntime();
  const human = runtime.retro.active ? null : runtime.currentHuman;
  const showObjective = runtime.analysisMode !== "maia";
  const showHuman = runtime.analysisMode !== "stockfish";
  const label = formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san });

  return (
    <section className={"dual-verdict dual-verdict-" + runtime.analysisMode} aria-label={"Current move " + label + " verdicts"}>
      {showObjective && (
        <div className="move-verdict objective-verdict">
          <QualityIcon classification={move.classification} size={24} />
          <strong>{label} · {displayedMoveQualityLabel(move)}</strong>
          <details>
            <summary>Why?</summary>
            <p>
              {move.classificationReason.precedenceRule.replaceAll("-", " ")}
              · Win% loss {move.classificationReason.winPercentLoss.toFixed(1)}
              · Accuracy {move.accuracy.toFixed(1)}
              · {formatEngineScore(move.evaluationBefore)} → {formatEngineScore(move.playedMoveScore)}
              {move.annotations.length > 0 ? ` · Annotations ${move.annotations.map((annotation) => annotation.replaceAll("_", " ")).join(", ")}` : ""}
            </p>
          </details>
        </div>
      )}
      {showHuman && (
        <details className="move-verdict human-verdict">
          <summary>
            <span>MAIA · HUMAN FIND DIFFICULTY</span>
            {human
              ? `${label} · ${HUMAN_DIFFICULTY_META[human.findDifficulty.label].label} to find`
              : runtime.humanPositionState === "running"
                ? "Reviewing this exact move…"
                : "Human move review not available yet"}
          </summary>
          {human ? (
            <>
              <p>
                {percentage(human.playedMoveProbability)} policy probability · rank #{human.playedMoveRank}
                {" · "}{modelLabel(human.model)} @ {human.targetElo}
                {human.playedMoveWdl
                  ? ` · WDL ${percentage(human.playedMoveWdl.win)} / ${percentage(human.playedMoveWdl.draw)} / ${percentage(human.playedMoveWdl.loss)}`
                  : ""}
              </p>
              <p>Experimental score {human.findDifficulty.score.toFixed(0)}/100 · {human.findDifficulty.evidence.probabilityBand} policy band</p>
            </>
          ) : (
            <p>{modelLabel(runtime.humanModel)} @ {runtime.humanTargetElo} · model prediction, never objective quality</p>
          )}
        </details>
      )}
      <Link
        className="explain-move-action"
        href={`/review/${runtime.gameId}/coach?ply=${move.ply}`}
        aria-label={`Explain this move: ${move.san}`}
      >
        Explain this move <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
