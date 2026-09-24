"use client";

import Link from "next/link";
import { formatMoveNotation, type MoveAnalysisV2 } from "@chess-review/shared";
import {
  HUMAN_DIFFICULTY_META,
  Icon,
  QualityIcon,
} from "@chess-review/ui";
import { useReviewRuntime } from "../review-runtime";
import {
  annotationsLabel,
  baselineOnlyCaveat,
  engineChoiceLabel,
  moveEvidenceSentence,
  sacrificeLabel,
  verificationLabel,
  winningChancesLabel,
} from "../../lib/move-evidence-copy";
import { displayedMoveQualityLabel } from "../../lib/move-quality-label";

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
          <QualityIcon classification={move.classification} size={16} />
          <strong>{label} · {displayedMoveQualityLabel(move)}</strong>
          <p className="move-verdict-sentence">{moveEvidenceSentence(move)}</p>
          {baselineOnlyCaveat(move) !== null && <p className="move-verdict-caveat">{baselineOnlyCaveat(move)}</p>}
          <details className="move-verdict-why review-panel-row">
            <summary>
              <Icon name="question" />
              <span className="review-row-copy"><strong>Why? · engine, win chances, search</strong></span>
              <span className="review-row-meta">{`Depth ${move.stockfish.depth}`}</span>
              <Icon className="review-row-chevron" name="chevron-right" />
            </summary>
            <dl className="move-verdict-evidence">
              <div><dt>Engine</dt><dd>{engineChoiceLabel(move.classificationReason)}</dd></div>
              <div><dt>Winning chances</dt><dd>{winningChancesLabel(move.classificationReason)}</dd></div>
              <div><dt>Accuracy</dt><dd>{move.accuracy.toFixed(1)}</dd></div>
              <div><dt>Search</dt><dd>{verificationLabel(move)}</dd></div>
              {sacrificeLabel(move.classificationReason) !== null && (
                <div><dt>Sacrifice</dt><dd>{sacrificeLabel(move.classificationReason)}</dd></div>
              )}
              {move.annotations.length > 0 && (
                <div><dt>Annotations</dt><dd>{annotationsLabel(move.annotations)}</dd></div>
              )}
              {move.classificationReason.exclusions.length > 0 && (
                <div><dt>Ruled out</dt><dd>{move.classificationReason.exclusions.join(", ").replaceAll("-", " ")}</dd></div>
              )}
            </dl>
            <details className="move-verdict-internals">
              <summary>Classification internals</summary>
              <code>{(move.classificationReason.qualityRule ?? move.classificationReason.precedenceRule)}</code>
            </details>
          </details>
        </div>
      )}
      {showHuman && (
        <details className="move-verdict human-verdict review-panel-row">
          <summary>
            <Icon name="evidence" />
            <span className="review-row-copy">
              <span>Evidence</span>
              <strong>
                {human
                  ? `${label} · ${HUMAN_DIFFICULTY_META[human.findDifficulty.label].label} to find`
                  : runtime.humanPositionState === "running"
                    ? "Reviewing this exact move…"
                    : "Human move review not available yet"}
              </strong>
            </span>
            <Icon className="review-row-chevron" name="chevron-right" />
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
