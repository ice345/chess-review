"use client";

import Link from "next/link";
import { masterySummary } from "../lib/training-mastery";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { StudyWeaknessKind, TrainingQueueItemV3, TrainingQueueStatus, UiLanguage } from "@chess-review/shared";
import { phaseLabel } from "@chess-review/ui";
import { subscribeLocalData } from "../lib/browser-storage";
import { useUiLanguage } from "../hooks/use-ui-language";
import { listTrainingQueue, removeTrainingQueueItem, startTrainingTask, trainingReviewHref } from "../lib/training-queue";

type QueueCopy = {
  decisionsSuffix: string;
  missedOpportunities: string;
  loadError: string;
  updateError: string;
  ariaLabel: string;
  heading: string;
  intro: string;
  retry: string;
  previouslyCompleted: string;
  allMastered: string;
  status: Record<TrainingQueueStatus, string>;
  progress: (reviewed: number, total: number, tail: string) => string;
  dueNow: (n: number) => string;
  notYetReviewed: (n: number) => string;
  masteredCount: (n: number) => string;
  reviewInGame: (san: string) => string;
  revisitPositions: string;
  continueReview: string;
  startReview: string;
  removeTask: string;
  showFewer: string;
  showAll: (n: number) => string;
};

const COPY: Record<UiLanguage, QueueCopy> = {
  en: {
    decisionsSuffix: " decisions",
    missedOpportunities: "Missed opportunities",
    loadError: "Unable to load review tasks.",
    updateError: "Unable to update this task. Try again.",
    ariaLabel: "Saved review tasks",
    heading: "Your review tasks",
    intro: "Return to the position before each decision, then inspect the played move. These open-book reviews are saved separately from mastery.",
    retry: "Retry",
    previouslyCompleted: "Previously completed manually",
    allMastered: "All positions mastered",
    status: { queued: "queued", "in-progress": "in progress", completed: "completed" },
    progress: (reviewed, total, tail) => `${reviewed} / ${total} positions reviewed · ${tail}`,
    dueNow: (n) => `${n} due now`,
    notYetReviewed: (n) => `${n} not yet reviewed`,
    masteredCount: (n) => `${n} mastered`,
    reviewInGame: (san) => `Review ${san} in the game`,
    revisitPositions: "Revisit positions",
    continueReview: "Continue review",
    startReview: "Start review",
    removeTask: "Remove task",
    showFewer: "Show fewer tasks",
    showAll: (n) => `Show all ${n} tasks`,
  },
  "zh-CN": {
    decisionsSuffix: "决策",
    missedOpportunities: "错过的机会",
    loadError: "无法加载复盘任务。",
    updateError: "无法更新此任务。请重试。",
    ariaLabel: "已保存的复盘任务",
    heading: "你的复盘任务",
    intro: "回到每一步决定之前的局面，再查看实战着法。这些开卷复盘与掌握进度分开保存。",
    retry: "重试",
    previouslyCompleted: "先前已手动完成",
    allMastered: "全部局面已掌握",
    status: { queued: "排队中", "in-progress": "进行中", completed: "已完成" },
    progress: (reviewed, total, tail) => `${reviewed} / ${total} 个局面已复习 · ${tail}`,
    dueNow: (n) => `${n} 个到期`,
    notYetReviewed: (n) => `${n} 个尚未复习`,
    masteredCount: (n) => `${n} 个已掌握`,
    reviewInGame: (san) => `在对局中复盘 ${san}`,
    revisitPositions: "再次查看局面",
    continueReview: "继续复盘",
    startReview: "开始复盘",
    removeTask: "移除任务",
    showFewer: "收起任务",
    showAll: (n) => `显示全部 ${n} 个任务`,
  },
};

export function trainingTitle(kind: StudyWeaknessKind, language: UiLanguage): string {
  const copy = COPY[language];
  if (kind === "missed-opportunities") return copy.missedOpportunities;
  const phase = kind === "opening-decisions" ? "opening" : kind === "middlegame-decisions" ? "middlegame" : "endgame";
  return `${phaseLabel(phase, language)}${copy.decisionsSuffix}`;
}

/** Independent of analysis availability, so restored tasks survive an empty cache. */
export function TrainingQueuePanel({ playerKey }: { playerKey?: string }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const router = useRouter();
  const [items, setItems] = useState<TrainingQueueItemV3[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { void listTrainingQueue(playerKey).then((value) => { if (active) { setItems(value); setError(null); } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : copy.loadError); }); };
    refresh();
    const unsubscribe = subscribeLocalData(refresh);
    return () => { active = false; unsubscribe(); };
  }, [playerKey, copy.loadError]);
  async function act(item: TrainingQueueItemV3, action: "start" | "remove") {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (action === "remove") { await removeTrainingQueueItem(item.id); setItems(await listTrainingQueue(playerKey)); }
      else router.push(trainingReviewHref(await startTrainingTask(item.id, language)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.updateError); }
    finally { working.current = false; setBusy(false); }
  }
  if (!items.length && !error) return null;
  return <section className="training-queue-panel" aria-label={copy.ariaLabel}>
    <h2>{copy.heading}</h2>
    <p>{copy.intro}</p>
    {error && <p className="error" role="alert">{error} <button type="button" className="text-button" onClick={() => { void listTrainingQueue(playerKey).then((value) => { setItems(value); setError(null); }).catch((cause) => setError(String(cause))); }}>{copy.retry}</button></p>}
    <div className="training-list">{(expanded ? items : items.slice(0, 3)).map((item) => {
      // Per row: only unaided reviews advance mastery, so a task cannot claim it.
      const mastery = masterySummary(item, new Date());
      const tail = mastery.due > 0 ? copy.dueNow(mastery.due) : mastery.unreviewed > 0 ? copy.notYetReviewed(mastery.unreviewed) : copy.masteredCount(mastery.mastered);
      return <article key={item.id} className={item.status}>
      <div><span className="training-status">{item.completionKind === "manual" ? copy.previouslyCompleted : item.status === "completed" ? copy.allMastered : copy.status[item.status]}</span><strong>{trainingTitle(item.weaknessKind, language)}</strong><small>{copy.progress(item.progress.reviewedPositionCount, item.progress.totalPositionCount, tail)}</small></div>
      <div className="training-sources">{item.evidence.map((source) => <Link key={`${source.gameId}:${source.ply}`} href={trainingReviewHref(item, source)} aria-label={copy.reviewInGame(source.san)}>{source.san}</Link>)}</div>
      <div className="training-actions"><button type="button" className="secondary" disabled={busy || !item.evidence.length} onClick={() => void act(item, "start")}>{item.completionKind === "mastered" ? copy.revisitPositions : item.status === "in-progress" ? copy.continueReview : copy.startReview}</button><button type="button" className="text-button" disabled={busy} onClick={() => void act(item, "remove")}>{copy.removeTask}</button></div>
    </article>;
    })}</div>
    {items.length > 3 && <button type="button" className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? copy.showFewer : copy.showAll(items.length)}</button>}
  </section>;
}
