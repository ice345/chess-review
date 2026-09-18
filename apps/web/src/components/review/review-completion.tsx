"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gameTrainingWeaknesses } from "@chess-review/analysis";
import { formatMoveNotation, type GameAnalysisV2, type PlayerColor } from "@chess-review/shared";
import { classificationForAnnotation, QualityIcon } from "@chess-review/ui";
import { buildReviewCompletion, type CompletionMoment } from "../../lib/review-completion";
import { displayedMoveQualityLabel, extraMoveAnnotations, ANNOTATION_LABEL } from "../../lib/move-quality-label";
import { reviewCompletionDetail, reviewCompletionHeadline, reviewSessionCounts, type ReviewSessionProgress } from "../../lib/review-session";
import { learnerColorForRecord } from "../../lib/player-identity";
import { studyPlayerKeyForRecord } from "../../lib/advanced-study-library";
import type { ReviewRecord } from "../../lib/review-library";
import {
  applyTrainingAddition,
  listTrainingQueue,
  planTrainingAddition,
  trainingGameContribution,
  type TrainingAddition,
  type TrainingAdditionResult,
} from "../../lib/training-queue";
import type { TrainingQueueItemV3 } from "@chess-review/shared";

/**
 * End-of-review state.
 *
 * Everything shown is either a canonical analysis fact or a count of this
 * session's own work; no new chess claim is generated, and nothing here waits on
 * a coach response. The headline counts what the session actually viewed, so
 * finishing early can never read as a finished review.
 */
export function ReviewCompletion({
  analysis,
  record,
  gameId,
  session,
  onClose,
}: {
  analysis: GameAnalysisV2;
  record: ReviewRecord;
  gameId: string;
  session: ReviewSessionProgress;
  onClose: () => void;
}) {
  const learner = learnerColorForRecord(record);
  // A manual import has no learner, so the visitor names the side. Start on the
  // side that actually recorded trainable positions; the choice stays theirs.
  const [side, setSide] = useState<PlayerColor>(() => learner ?? sideWithMostEvidence(analysis, gameId));
  const facts = buildReviewCompletion(analysis, learner);
  const counts = reviewSessionCounts(session, analysis.criticalMoments);
  const { items: queue, reload: reloadQueue } = useTrainingQueue();
  const addition = useTrainingAddition(analysis, record, gameId, side, queue, reloadQueue);

  return (
    <section className="review-completion" aria-label="Review complete">
      <header>
        <span className="kicker">Review complete</span>
        <h2>{reviewCompletionHeadline(counts)}</h2>
        <p className="review-completion-detail">{reviewCompletionDetail(counts)}</p>
        {counts.attempted > 0 && (
          <p className="review-completion-tally">
            {`Solved ${counts.solvedUnassisted}`}
            {counts.hinted > 0 ? `, hinted ${counts.hinted}` : ""}
            {counts.revealed > 0 ? `, viewed ${counts.revealed}` : ""}
            {counts.skipped > 0 ? `, skipped ${counts.skipped}` : ""}
            {"."}
            {counts.hinted > 0 ? " A hinted position is not counted as solved." : ""}
            {counts.afterExposure > 0
              ? ` ${counts.afterExposure} of them followed a position whose analysis you had already seen, so they are practice rather than a first-time find.`
              : ""}
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
                <strong>{formatMoveNotation(facts.mostImportantMistake)}</strong>
                {facts.scope === "both" && <span className="review-completion-color">{facts.mostImportantMistake.color === "white" ? "White" : "Black"}</span>}
                <small>{displayedMoveQualityLabel(facts.mostImportantMistake)} · gave up {facts.mostImportantMistake.loss.toFixed(1)}% win probability</small>
              </span>
            </dd>
          </div>
        )}
        {facts.highlight && (
          <div>
            <dt>Worth another look</dt>
            <dd>
              <HighlightIcon moment={facts.highlight} />
              <span>
                <strong>{formatMoveNotation(facts.highlight)}</strong>
                {facts.scope === "both" && <span className="review-completion-color">{facts.highlight.color === "white" ? "White" : "Black"}</span>}
                <small>{highlightEvidence(facts.highlight)}</small>
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

      <TrainingHandoff
        analysis={analysis}
        gameId={gameId}
        learner={learner}
        side={side}
        onSide={setSide}
        queue={queue}
        addition={addition}
      />

      <div className="review-completion-actions">
        <Link className="primary-link" href={`/review/${gameId}/moves`}>Review the moves →</Link>
        <Link className="secondary-link" href="/training">Open Practice</Link>
        <Link className="secondary-link" href={`/review/${gameId}/coach`}>Study this game</Link>
        <button type="button" className="text-button" onClick={onClose}>Back to key moments</button>
      </div>
    </section>
  );
}

/** The canonical classification icon, plus any annotation the row's icon does not show. */
function HighlightIcon({ moment }: { moment: CompletionMoment }) {
  return (
    <span className="review-completion-icons">
      <QualityIcon classification={moment.classification} size={22} />
      {extraMoveAnnotations(moment).map((annotation) => (
        <QualityIcon classification={classificationForAnnotation(annotation)} size={22} key={annotation} title={ANNOTATION_LABEL[annotation]} />
      ))}
    </span>
  );
}

/** Why this move was selected, from its own canonical evidence. */
function highlightEvidence(moment: CompletionMoment): string {
  const labels = moment.annotations.map((annotation) => ANNOTATION_LABEL[annotation]);
  return `${labels.length > 0 ? `${labels.join(", ")} · ` : ""}${displayedMoveQualityLabel(moment)} · Accuracy ${moment.accuracy.toFixed(1)}`;
}

/**
 * The handoff into Practice: the exact positions this game would contribute.
 *
 * The offer and the result state the same numbers because both come from
 * `planTrainingAddition`. The learner is the record's own account when the game
 * has one; otherwise the visitor chooses the side, which is what makes the
 * resulting task belong to a player the Practice page already knows.
 */
function TrainingHandoff({
  analysis,
  gameId,
  learner,
  side,
  onSide,
  queue,
  addition,
}: {
  analysis: GameAnalysisV2;
  gameId: string;
  learner: PlayerColor | null;
  side: PlayerColor;
  onSide: (side: PlayerColor) => void;
  queue: TrainingQueueItemV3[] | null;
  addition: TrainingHandoffState;
}) {
  const training = queue === null ? null : trainingGameContribution(queue, gameId);

  if (queue === null || addition.plan === null) {
    return <p className="review-completion-training">Practice positions load with your local library.</p>;
  }

  const planned = addition.plan.reduce((total, entry) => total + entry.add.length, 0);
  const already = addition.plan.reduce((total, entry) => total + entry.alreadyPresent, 0);
  const deferred = addition.plan.reduce((total, entry) => total + entry.deferred, 0);
  const taskIds = [...new Set(addition.plan.filter((entry) => entry.add.length > 0).map((entry) => entry.taskId))];
  const addedTask = addition.result?.taskIds[0];
  const trainingHref = addition.result === null || addedTask === undefined
    ? "/training"
    : `/training?${new URLSearchParams({ player: addition.playerKey ?? "", task: addedTask })}`;
  const positions = addition.plan.flatMap((entry) => entry.add);

  return (
    <section className="review-completion-training-block" aria-label="Add this game to Practice">
      <p className="review-completion-training">
        {training !== null && training.positions > 0
          ? `${training.positions} ${training.positions === 1 ? "position" : "positions"} from this game ${training.positions === 1 ? "is" : "are"} already in Practice across ${training.tasks} ${training.tasks === 1 ? "task" : "tasks"}.`
          : "No position from this game is in Practice yet."}
      </p>

      {learner === null && (
        <fieldset className="review-completion-side">
          <legend>Whose positions are these?</legend>
          {(["white", "black"] as const).map((color) => (
            <button
              type="button"
              key={color}
              className={side === color ? "active" : ""}
              aria-pressed={side === color}
              onClick={() => onSide(color)}
            >
              {color === "white" ? "White" : "Black"}
            </button>
          ))}
        </fieldset>
      )}

      {planned > 0 && (
        <>
          <p className="review-completion-offer">
            {`${planned} ${planned === 1 ? "position" : "positions"} will join ${taskIds.length} practice ${taskIds.length === 1 ? "task" : "tasks"}.`}
          </p>
          <ul className="review-completion-positions">
            {positions.map((position) => (
              <li key={`${position.gameId}:${position.ply}`}>
                <QualityIcon classification={position.classification} size={18} decorative />
                <span>{formatMoveNotation({ fenBefore: fenBeforeFor(analysis, position.ply), color: analysis.moves[position.ply - 1]?.color ?? "white", san: position.san })}</span>
                <small>−{position.winPercentLoss.toFixed(1)} Win%</small>
              </li>
            ))}
          </ul>
          <button type="button" className="primary" disabled={addition.busy || addition.playerKey === null} onClick={() => void addition.add()}>
            {addition.busy ? "Adding…" : `Add ${planned === 1 ? "this position" : `these ${planned} positions`} to Practice`}
          </button>
        </>
      )}

      {deferred > 0 && (
        <p className="review-completion-training">{`${deferred} ${deferred === 1 ? "position does" : "positions do"} not fit the five-position limit of a task and ${deferred === 1 ? "was" : "were"} not added.`}</p>
      )}
      {planned === 0 && already > 0 && <p className="review-completion-training">Every position from this game is already in Practice.</p>}
      {planned === 0 && already === 0 && <p className="review-completion-training">This game recorded no position that the training queue accepts.</p>}

      {addition.result !== null && (
        <p className="review-completion-training" role="status">
          {`Added ${addition.result.summary.added} ${addition.result.summary.added === 1 ? "position" : "positions"} to ${addition.result.summary.tasks} ${addition.result.summary.tasks === 1 ? "task" : "tasks"}. `}
          <Link href={trainingHref}>Open the task →</Link>
        </p>
      )}
      {addition.error !== null && <p className="error" role="alert">{addition.error}</p>}
    </section>
  );
}

function sideWithMostEvidence(analysis: GameAnalysisV2, gameId: string): PlayerColor {
  const evidence = (color: PlayerColor) => gameTrainingWeaknesses(analysis, gameId, color)
    .reduce((total, weakness) => total + weakness.evidence.length, 0);
  return evidence("black") > evidence("white") ? "black" : "white";
}

/** The position before a move, so the move notation matches every other surface. */
function fenBeforeFor(analysis: GameAnalysisV2, ply: number): string {
  return analysis.moves[ply - 1]?.fenBefore ?? analysis.game.initialFen;
}

interface TrainingHandoffState {
  /** The plan for the chosen side, or null when that side cannot name a player. */
  plan: TrainingAddition[] | null;
  playerKey: string | null;
  busy: boolean;
  /** What the last write stored, and which tasks it touched. */
  result: { summary: TrainingAdditionResult; taskIds: string[] } | null;
  error: string | null;
  add: () => Promise<void>;
}

function useTrainingQueue(): { items: TrainingQueueItemV3[] | null; reload: () => Promise<void> } {
  const [items, setItems] = useState<TrainingQueueItemV3[] | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let active = true;
    void listTrainingQueue()
      .then((loaded) => { if (active) setItems(loaded); })
      .catch(() => { if (active) setItems(null); });
    return () => { active = false; };
  }, [generation]);
  return {
    items,
    reload: async () => { setGeneration((current) => current + 1); },
  };
}

function useTrainingAddition(
  analysis: GameAnalysisV2,
  record: ReviewRecord,
  gameId: string,
  side: PlayerColor,
  queue: TrainingQueueItemV3[] | null,
  reloadQueue: () => Promise<void>,
): TrainingHandoffState {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ summary: TrainingAdditionResult; taskIds: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerKey = studyPlayerKeyForRecord(record, analysis, side);
  const plan = queue === null || playerKey === null
    ? null
    : planTrainingAddition(queue, playerKey, gameTrainingWeaknesses(analysis, gameId, side));

  async function add() {
    if (plan === null || playerKey === null) return;
    setBusy(true);
    setError(null);
    // The task ids come from the plan that was written, not from the queue the
    // write is about to change.
    const taskIds = [...new Set(plan.filter((entry) => entry.add.length > 0).map((entry) => entry.taskId))];
    try {
      setResult({ summary: await applyTrainingAddition(playerKey, plan), taskIds });
      // The offer is recomputed from the stored queue, so a second click cannot
      // add the same positions twice and the counts stay true.
      await reloadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add these positions. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Changing the side starts a new offer; a stored result belongs to the old one.
  useEffect(() => { setResult(null); setError(null); }, [playerKey]);

  return { plan, playerKey, busy, result, error, add };
}
