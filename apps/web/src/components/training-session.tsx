"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { subscribeLocalData } from "../lib/browser-storage";
import type { ReviewRecord } from "../lib/review-library";
import { listTrainingQueue, nextTrainingPosition, reviewTrainingPosition, trainingPositionKey, trainingReviewHref, validateTrainingSource } from "../lib/training-queue";
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
  const onSource = source && !state.branch && state.currentPly === source.ply;
  const next = item ? nextTrainingPosition(item) : undefined;
  async function confirm() {
    if (!item || !source || !onSource || !state.analysis || sourceError || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try { setItem(await reviewTrainingPosition(item.id, source)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Progress could not be saved. Try again."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="training-session" aria-label="Position review task">
    <div><span className="kicker">Position review</span><h2>{item ? TRAINING_TITLES[item.weaknessKind] : "Loading task…"}</h2>
      {item && <p role="status">{item.progress.reviewedPositionCount} / {item.progress.totalPositionCount} positions reviewed{item.completionKind === "reviewed" ? " · Review complete" : reviewed ? " · This position is saved" : ""}</p>}
      <p>Compare the played move with its objective evidence, explore the continuation, then confirm your review.</p>
    </div>
    <div className="training-session-actions">
      {!sourceError && source && <>
        {!onSource && <button type="button" className="secondary" onClick={() => { state.returnToGame(); state.goToPly(source.ply); }}>Return to task position</button>}
        {!reviewed && <button type="button" className="primary" disabled={busy || !onSource || !state.analysis} onClick={() => void confirm()}>{busy ? "Saving…" : "Mark position reviewed"}</button>}
        {reviewed && next && <Link className="primary-link" href={trainingReviewHref(item!, next)}>Next position →</Link>}
        {!state.analysis && <small>Analyze this game to restore its objective evidence before confirming.</small>}
      </>}
      <Link className="text-button" href="/training">{item?.completionKind === "reviewed" ? "Back to Training →" : "Pause and return to Training"}</Link>
    </div>
    {(error || sourceError) && <p className="error" role="alert">{error ?? sourceError} <button type="button" className="text-button" onClick={() => window.location.reload()}>Reload task</button></p>}
  </section>;
}
