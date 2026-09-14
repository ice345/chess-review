"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoveNumber, formatMoveNotation, type GameAnalysisV2, type PlayerColor } from "@chess-review/shared";
import { QualityIcon } from "@chess-review/ui";
import { buildReviewCompletion } from "../../lib/review-completion";
import { displayedMoveQualityLabel } from "../../lib/move-quality-label";
import { listTrainingQueue } from "../../lib/training-queue";

/**
 * End-of-review state.
 *
 * Everything shown is either a canonical analysis fact or a count of this
 * session's own work; no new chess claim is generated, and nothing here waits on
 * a coach response.
 */
export function ReviewCompletion({
  analysis,
  player,
  gameId,
  tally,
  onClose,
}: {
  analysis: GameAnalysisV2;
  player: PlayerColor | null;
  gameId: string;
  tally: { solved: number; hinted: number; revealed: number; skipped: number };
  onClose: () => void;
}) {
  const facts = buildReviewCompletion(analysis, player);
  const trainingCount = useTrainingCount(gameId);
  const practiced = tally.solved + tally.hinted + tally.revealed + tally.skipped;

  return (
    <section className="review-completion" aria-label="Review complete">
      <header>
        <span className="kicker">Review complete</span>
        <h2>{facts.keyMomentCount === 0 ? "No key moment crossed the thresholds" : `${facts.keyMomentCount} key ${facts.keyMomentCount === 1 ? "moment" : "moments"} reviewed`}</h2>
        {practiced > 0 && (
          <p className="review-completion-tally">
            {`Solved ${tally.solved}`}
            {tally.hinted > 0 ? `, hinted ${tally.hinted}` : ""}
            {tally.revealed > 0 ? `, viewed ${tally.revealed}` : ""}
            {tally.skipped > 0 ? `, skipped ${tally.skipped}` : ""}
            {"."}
            {tally.hinted > 0 ? " A hinted position is not counted as solved." : ""}
          </p>
        )}
      </header>

      <dl className="review-completion-facts">
        {facts.mostImportantMistake && (
          <div>
            <dt>Most important mistake</dt>
            <dd>
              <QualityIcon classification={facts.mostImportantMistake.classification} size={22} />
              <span>
                <strong>{formatMoveNumber(facts.mostImportantMistake.fenBefore, facts.mostImportantMistake.color)} {facts.mostImportantMistake.san}</strong>
                <small>{displayedMoveQualityLabel(facts.mostImportantMistake)} · gave up {facts.mostImportantMistake.swing.toFixed(1)}% win probability</small>
              </span>
            </dd>
          </div>
        )}
        {facts.bestMoment && (
          <div>
            <dt>Best moment</dt>
            <dd>
              <QualityIcon classification={facts.bestMoment.classification} size={22} />
              <span>
                <strong>{formatMoveNotation({ fenBefore: facts.bestMoment.fenBefore, color: facts.bestMoment.color, san: facts.bestMoment.san })}</strong>
                <small>{displayedMoveQualityLabel(facts.bestMoment)} · Accuracy {facts.bestMoment.accuracy.toFixed(1)}</small>
              </span>
            </dd>
          </div>
        )}
        {facts.lesson && (
          <div>
            <dt>This game</dt>
            <dd><span><strong>{facts.lesson}</strong></span></dd>
          </div>
        )}
      </dl>

      <p className="review-completion-training">
        {trainingCount === null
          ? "Training positions load with your local library."
          : trainingCount === 0
            ? "No position from this game is in Training yet."
            : `${trainingCount} ${trainingCount === 1 ? "position" : "positions"} from this game ${trainingCount === 1 ? "is" : "are"} in Training.`}
      </p>

      <div className="review-completion-actions">
        <Link className="primary-link" href={`/review/${gameId}/moves`}>Review the moves →</Link>
        <Link className="secondary-link" href="/training">Open Training</Link>
        <Link className="secondary-link" href={`/review/${gameId}/coach`}>Study this game</Link>
        <button type="button" className="text-button" onClick={onClose}>Back to key moments</button>
      </div>
    </section>
  );
}

/** How many Training positions this game contributed. Null until the local library answers. */
function useTrainingCount(gameId: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void listTrainingQueue()
      .then((items) => {
        if (!active) return;
        setCount(items.filter((item) => item.evidence.some((reference) => reference.gameId === gameId)).length);
      })
      .catch(() => { if (active) setCount(null); });
    return () => { active = false; };
  }, [gameId]);
  return count;
}
