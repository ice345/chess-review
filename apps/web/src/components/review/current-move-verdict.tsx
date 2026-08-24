"use client";

import Link from "next/link";
import type { MoveAnalysis } from "@chess-review/shared";
import {
  HUMAN_DIFFICULTY_META,
  HumanDifficultyMark,
  QUALITY_META,
  QualityIcon,
} from "@chess-review/ui";
import { useReviewRuntime } from "../review-runtime";
import { formatEngineScore } from "../../lib/review-format";

function percentage(value: number): string {
  return (value * 100).toFixed(value < 0.1 ? 1 : 0) + "%";
}

function modelLabel(model: string): string {
  return model.replace("maia3-", "Maia-3 ").toUpperCase();
}

export function CurrentMoveVerdict({ move }: { move: MoveAnalysis }) {
  const runtime = useReviewRuntime();
  const human = runtime.currentHuman;
  const showObjective = runtime.analysisMode !== "maia";
  const showHuman = runtime.analysisMode !== "stockfish";

  return (
    <section className={"dual-verdict dual-verdict-" + runtime.analysisMode} aria-label={"Current move " + move.ply + " verdicts"}>
      {showObjective && (
        <div className="move-verdict objective-verdict">
          <QualityIcon classification={move.classification} size={40} />
          <div>
            <span>STOCKFISH · OBJECTIVE MOVE QUALITY</span>
            <strong>{move.ply}. {move.san} · {QUALITY_META[move.classification].label}</strong>
            <small>Accuracy {move.accuracy.toFixed(1)} · {formatEngineScore(move.evaluationBefore)} → {formatEngineScore(move.playedMoveScore)}</small>
          </div>
          <details>
            <summary>Why?</summary>
            <p>{move.classificationReason.precedenceRule.replaceAll("-", " ")} · Win% loss {move.classificationReason.winPercentLoss.toFixed(1)}</p>
          </details>
        </div>
      )}
      {showHuman && (
        <div className="move-verdict human-verdict">
          {human ? <HumanDifficultyMark difficulty={human.findDifficulty.label} size={40} /> : <span className="human-mark-placeholder">◇</span>}
          <div>
            <span>MAIA · HUMAN FIND DIFFICULTY</span>
            {human ? (
              <>
                <strong>{move.ply}. {move.san} · {HUMAN_DIFFICULTY_META[human.findDifficulty.label].label} to find</strong>
                <small>
                  {percentage(human.playedMoveProbability)} policy probability · rank #{human.playedMoveRank}
                  {" · "}{modelLabel(human.model)} @ {human.targetElo}
                </small>
                {human.playedMoveWdl && (
                  <small>Played-move human WDL · W {percentage(human.playedMoveWdl.win)} · D {percentage(human.playedMoveWdl.draw)} · L {percentage(human.playedMoveWdl.loss)}</small>
                )}
              </>
            ) : (
              <>
                <strong>{runtime.humanPositionState === "running" ? "Reviewing this exact move…" : "Human move review not available yet"}</strong>
                <small>{modelLabel(runtime.humanModel)} @ {runtime.humanTargetElo} · model prediction, never objective quality</small>
              </>
            )}
          </div>
          {human && (
            <details>
              <summary>Evidence</summary>
              <p>Experimental score {human.findDifficulty.score.toFixed(0)}/100 · {human.findDifficulty.evidence.probabilityBand} policy band</p>
            </details>
          )}
        </div>
      )}
      <Link
        className="explain-move-action"
        href={`/review/${runtime.gameId}/coach`}
        aria-label={`Explain this move: ${move.san}`}
      >
        Explain this move <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
