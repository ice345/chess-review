"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { subscribeLocalData } from "../lib/browser-storage";
import type { ReviewRecord } from "../lib/review-library";
import { dueTrainingPositions } from "../lib/training-mastery";
import { listTrainingQueue, nextTrainingPosition, reviewTrainingPosition, trainingPositionKey, trainingReviewHref, validateTrainingSource } from "../lib/training-queue";
import type { TrainingAttemptOutcome } from "@chess-review/shared";
import { useReviewStore } from "../store/review-store";
import { TRAINING_TITLES } from "./training-queue-panel";

export function TrainingSession({ taskId, positionKey, record }: { taskId: string; positionKey: string | null; record: ReviewRecord }) {
  const state = useReviewStore();
  const [item, setItem] = useState<TrainingQueueItemV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { void listTrainingQueue().then((items) => {
      if (!active) return;
      const found = items.find((candidate) => candidate.id === taskId);
      setItem(found ?? null); setError(found ? null : "This training task no longer exists.");
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this task."); }); };
    setItem(null); refresh();
    const unsubscribe = subscribeLocalData(refresh);
    return () => { active = false; unsubscribe(); };
  }, [taskId]);
  const source = item?.evidence.find((candidate) => trainingPositionKey(candidate) === positionKey && candidate.gameId === record.id);
  let sourceError: string | null = null;
  if (item) {
    try { if (!source) throw new Error("This position is not part of the selected task."); validateTrainingSource(record, source); }
    catch (cause) { sourceError = cause instanceof Error ? cause.message : "The source position is unavailable."; }
  }
  const reviewed = source && item?.progress.positions.some((position) => trainingPositionKey(position) === trainingPositionKey(source));
  // A position is reviewable while it is unreviewed or has come round again; a mastered
  // position that is not due yet is not today's work.
  const due = source && item ? dueTrainingPositions(item, new Date()).some((position) => trainingPositionKey(position) === trainingPositionKey(source)) : false;
  const reviewable = Boolean(source) && (!reviewed || due);
  const onSource = source && !state.branch && state.currentPly === source.ply;
  const savedReview = source && item?.progress.positions.find((position) => trainingPositionKey(position) === trainingPositionKey(source));
  const savedSummary = savedReview === undefined || savedReview === null
    ? undefined
    : `${savedReview.mastery === "mastered" ? "Mastered" : savedReview.mastery === "review" ? "In review" : "Learning"}${savedReview.dueAt === undefined ? "" : ` · next review ${new Date(savedReview.dueAt).toLocaleDateString()}`}`;
  const next = item ? nextTrainingPosition(item) : undefined;
  const nextPositionKey = next ? trainingPositionKey(next) : undefined;
  // Position-scoped, because that is what the panel is about: it answers "when is this
  // one worth doing again", and it stays true beside a "Next position" link.
  const nextDueNote = savedReview?.dueAt === undefined
    ? "This position is not due again yet."
    : `This position is not due again until ${new Date(savedReview.dueAt).toLocaleDateString()}.`;
  async function confirm(outcome: TrainingAttemptOutcome) {
    if (!item || !source || !onSource || !state.analysis || sourceError || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try { setItem(await reviewTrainingPosition(item.id, source, outcome)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Progress could not be saved. Try again."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="training-session" aria-label="Position review task">
    <div><span className="kicker">Position review</span><h2>{item ? TRAINING_TITLES[item.weaknessKind] : "Loading task…"}</h2>
      {item && <p role="status">{item.progress.reviewedPositionCount} / {item.progress.totalPositionCount} positions reviewed{item.completionKind === "mastered" ? " · Every position mastered" : reviewed ? ` · ${savedSummary ?? "This position is saved"}` : ""}</p>}
      <p>Compare the played move with its objective evidence, explore the continuation, then say what happened: reviewed means looked at, and only a move you produced unaided, on a day the position came due, counts towards mastery.</p>
    </div>
    <div className="training-session-actions">
      {!sourceError && source && <>
        {!onSource && <button type="button" className="secondary" onClick={() => { state.returnToGame(); state.goToPly(source.ply); }}>Return to task position</button>}
        {reviewable && <>
          {/* One action, three honest outcomes. The schedule is built from what the
              visitor actually did: produced the move, got there with help, or read the
              evidence that was on screen. "Reviewed" makes no claim about recall, and a
              position that has come round again is reviewed again — that is the ladder. */}
          <button type="button" className="primary" disabled={busy || !onSource || !state.analysis} onClick={() => void confirm("exposed")}>{busy ? "Saving…" : reviewed ? "Mark position reviewed again" : "Mark position reviewed"}</button>
          <button type="button" className="secondary" disabled={busy || !onSource || !state.analysis} onClick={() => void confirm("unaided")}>I knew this move</button>
          <button type="button" className="secondary" disabled={busy || !onSource || !state.analysis} onClick={() => void confirm("hinted")}>I guessed</button>
        </>}
        {reviewed && next && nextPositionKey !== positionKey && <Link className="primary-link" href={trainingReviewHref(item!, next)}>Next position →</Link>}
        {reviewed && !next && item && <small role="status">{nextDueNote}</small>}
        {!state.analysis && <small>Analyze this game to restore its objective evidence before confirming.</small>}
      </>}
      <Link className="text-button" href="/training">{item?.completionKind === "mastered" ? "Back to Practice →" : "Pause and return to Practice"}</Link>
    </div>
    {(error || sourceError) && <p className="error" role="alert">{error ?? sourceError} <button type="button" className="text-button" onClick={() => window.location.reload()}>Reload task</button></p>}
  </section>;
}
