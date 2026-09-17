"use client";

import Link from "next/link";
import { masterySummary } from "../lib/training-mastery";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { subscribeLocalData } from "../lib/browser-storage";
import { listTrainingQueue, removeTrainingQueueItem, startTrainingTask, trainingReviewHref } from "../lib/training-queue";

export const TRAINING_TITLES = { "opening-decisions": "Opening decisions", "middlegame-decisions": "Middlegame decisions", "endgame-decisions": "Endgame decisions", "missed-opportunities": "Missed opportunities" };

/** Independent of analysis availability, so restored tasks survive an empty cache. */
export function TrainingQueuePanel() {
  const router = useRouter();
  const [items, setItems] = useState<TrainingQueueItemV3[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { void listTrainingQueue().then((value) => { if (active) { setItems(value); setError(null); } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load review tasks."); }); };
    refresh();
    const unsubscribe = subscribeLocalData(refresh);
    return () => { active = false; unsubscribe(); };
  }, []);
  async function act(item: TrainingQueueItemV3, action: "start" | "remove") {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (action === "remove") { await removeTrainingQueueItem(item.id); setItems(await listTrainingQueue()); }
      else router.push(trainingReviewHref(await startTrainingTask(item.id)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this task. Try again."); }
    finally { working.current = false; setBusy(false); }
  }
  if (!items.length && !error) return null;
  return <section className="training-queue-panel" aria-label="Saved review tasks">
    <h2>Your review tasks</h2>
    <p>Review each source decision, then say what happened. A review is not mastery: only a move you produced unaided advances the schedule, and a task is due again when its next review date arrives.</p>
    {error && <p className="error" role="alert">{error} <button type="button" className="text-button" onClick={() => { void listTrainingQueue().then((value) => { setItems(value); setError(null); }).catch((cause) => setError(String(cause))); }}>Retry</button></p>}
    <div className="training-list">{(expanded ? items : items.slice(0, 3)).map((item) => {
      // Per row: only unaided reviews advance mastery, so a task cannot claim it.
      const mastery = masterySummary(item, new Date());
      return <article key={item.id} className={item.status}>
      <div><span className="training-status">{item.completionKind === "manual" ? "Previously completed manually" : item.status === "completed" ? "All positions mastered" : item.status.replace("-", " ")}</span><strong>{TRAINING_TITLES[item.weaknessKind]}</strong><small>{item.progress.reviewedPositionCount} / {item.progress.totalPositionCount} positions reviewed · {mastery.due > 0 ? `${mastery.due} due now` : mastery.unreviewed > 0 ? `${mastery.unreviewed} not yet reviewed` : `${mastery.mastered} mastered`}</small></div>
      <div className="training-sources">{item.evidence.map((source) => <Link key={`${source.gameId}:${source.ply}`} href={trainingReviewHref(item, source)} aria-label={`Review ${source.san} in the game`}>{source.san}</Link>)}</div>
      <div className="training-actions"><button type="button" className="secondary" disabled={busy || !item.evidence.length} onClick={() => void act(item, "start")}>{item.completionKind === "mastered" ? "Revisit positions" : item.status === "in-progress" ? "Continue review" : "Start review"}</button><button type="button" className="text-button" disabled={busy} onClick={() => void act(item, "remove")}>Remove task</button></div>
    </article>;
    })}</div>
    {items.length > 3 && <button type="button" className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer tasks" : `Show all ${items.length} tasks`}</button>}
  </section>;
}
