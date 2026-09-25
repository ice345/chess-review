"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TrainingQueueItemV3, UiLanguage } from "@chess-review/shared";
import { subscribeLocalData } from "../lib/browser-storage";
import type { ReviewRecord } from "../lib/review-library";
import { dueTrainingPositions } from "../lib/training-mastery";
import { listTrainingQueue, nextTrainingPosition, reviewTrainingPosition, trainingPositionKey, trainingReviewHref, validateTrainingSource } from "../lib/training-queue";
import { useUiLanguage } from "../hooks/use-ui-language";
import { useReviewStore } from "../store/review-store";
import { trainingTitle } from "./training-queue-panel";

type SessionCopy = {
  missingTask: string;
  loadError: string;
  notInTask: string;
  sourceUnavailable: string;
  saveError: string;
  mastered: string;
  inReview: string;
  learning: string;
  nextReview: (date: string) => string;
  notDueYet: string;
  notDueUntil: (date: string) => string;
  ariaLabel: string;
  kicker: string;
  loadingTask: string;
  positionsReviewed: (reviewed: number, total: number, extra: string) => string;
  everyMastered: string;
  positionSaved: string;
  intro: string;
  beforeDecision: string;
  showPlayed: (san: string) => string;
  saving: string;
  markAgain: string;
  markReviewed: string;
  nextPosition: string;
  analyzeFirst: string;
  backToPractice: string;
  pauseReturn: string;
  reloadTask: string;
};

const COPY: Record<UiLanguage, SessionCopy> = {
  en: {
    missingTask: "This training task no longer exists.",
    loadError: "Unable to load this task.",
    notInTask: "This position is not part of the selected task.",
    sourceUnavailable: "The source position is unavailable.",
    saveError: "Progress could not be saved. Try again.",
    mastered: "Mastered",
    inReview: "In review",
    learning: "Learning",
    nextReview: (date) => ` · next review ${date}`,
    notDueYet: "This position is not due again yet.",
    notDueUntil: (date) => `This position is not due again until ${date}.`,
    ariaLabel: "Position review task",
    kicker: "Position review",
    loadingTask: "Loading task…",
    positionsReviewed: (reviewed, total, extra) => `${reviewed} / ${total} positions reviewed${extra}`,
    everyMastered: " · Every position mastered",
    positionSaved: "This position is saved",
    intro: "Start before the decision. Inspect the played move and its continuation when you are ready. This is an open-book review: saving it does not count as an unaided solve.",
    beforeDecision: "Before the decision",
    showPlayed: (san) => `Show played move · ${san}`,
    saving: "Saving…",
    markAgain: "Mark position reviewed again",
    markReviewed: "Mark position reviewed",
    nextPosition: "Next position →",
    analyzeFirst: "Analyze this game to restore its objective evidence before confirming.",
    backToPractice: "Back to Practice →",
    pauseReturn: "Pause and return to Practice",
    reloadTask: "Reload task",
  },
  "zh-CN": {
    missingTask: "此训练任务已不存在。",
    loadError: "无法加载此任务。",
    notInTask: "此局面不属于所选任务。",
    sourceUnavailable: "源局面不可用。",
    saveError: "进度未能保存。请重试。",
    mastered: "已掌握",
    inReview: "复习中",
    learning: "学习中",
    nextReview: (date) => ` · 下次复习 ${date}`,
    notDueYet: "此局面尚未再次到期。",
    notDueUntil: (date) => `此局面要到 ${date} 才再次到期。`,
    ariaLabel: "局面复盘任务",
    kicker: "局面复盘",
    loadingTask: "正在加载任务…",
    positionsReviewed: (reviewed, total, extra) => `${reviewed} / ${total} 个局面已复习${extra}`,
    everyMastered: " · 每个局面均已掌握",
    positionSaved: "此局面已保存",
    intro: "从决定之前的局面开始。准备好后再查看实战着法及其后续。这是开卷复盘：保存并不算独立解题。",
    beforeDecision: "决定之前",
    showPlayed: (san) => `显示实战着法 · ${san}`,
    saving: "保存中…",
    markAgain: "再次标记为已复习",
    markReviewed: "标记局面已复习",
    nextPosition: "下一局面 →",
    analyzeFirst: "请先分析本局，恢复客观证据后再确认。",
    backToPractice: "返回训练 →",
    pauseReturn: "暂停并返回训练",
    reloadTask: "重新加载任务",
  },
};

export function TrainingSession({ taskId, positionKey, record }: { taskId: string; positionKey: string | null; record: ReviewRecord }) {
  const language = useUiLanguage();
  const copy = COPY[language];
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
      setItem(found ?? null); setError(found ? null : copy.missingTask);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : copy.loadError); }); };
    setItem(null); refresh();
    const unsubscribe = subscribeLocalData(refresh);
    return () => { active = false; unsubscribe(); };
  }, [taskId, copy.missingTask, copy.loadError]);
  const source = item?.evidence.find((candidate) => trainingPositionKey(candidate) === positionKey && candidate.gameId === record.id);
  let sourceError: string | null = null;
  if (item) {
    try { if (!source) throw new Error(copy.notInTask); validateTrainingSource(record, source, language); }
    catch (cause) { sourceError = cause instanceof Error ? cause.message : copy.sourceUnavailable; }
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
    : `${savedReview.mastery === "mastered" ? copy.mastered : savedReview.mastery === "review" ? copy.inReview : copy.learning}${savedReview.dueAt === undefined ? "" : copy.nextReview(new Date(savedReview.dueAt).toLocaleDateString())}`;
  const next = item ? nextTrainingPosition(item) : undefined;
  const nextPositionKey = next ? trainingPositionKey(next) : undefined;
  // Position-scoped, because that is what the panel is about: it answers "when is this
  // one worth doing again", and it stays true beside a "Next position" link.
  const nextDueNote = savedReview?.dueAt === undefined
    ? copy.notDueYet
    : copy.notDueUntil(new Date(savedReview.dueAt).toLocaleDateString());
  async function confirm() {
    if (!item || !source || !onSource || !state.analysis || sourceError || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try { setItem(await reviewTrainingPosition(item.id, source, "exposed", language)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : copy.saveError); }
    finally { saving.current = false; setBusy(false); }
  }
  const extra = item?.completionKind === "mastered" ? copy.everyMastered : reviewed ? ` · ${savedSummary ?? copy.positionSaved}` : "";
  return <section className="training-session" aria-label={copy.ariaLabel}>
    <div><span className="kicker">{copy.kicker}</span><h2>{item ? trainingTitle(item.weaknessKind, language) : copy.loadingTask}</h2>
      {item && <p role="status">{copy.positionsReviewed(item.progress.reviewedPositionCount, item.progress.totalPositionCount, extra)}</p>}
      <p>{copy.intro}</p>
    </div>
    <div className="training-session-actions">
      {!sourceError && source && <>
        <button type="button" className="secondary" onClick={() => { state.returnToGame(); state.goToPly(Math.max(0, source.ply - 1)); }}>{copy.beforeDecision}</button>
        {!onSource && <button type="button" className="secondary" onClick={() => { state.returnToGame(); state.goToPly(source.ply); }}>{copy.showPlayed(source.san)}</button>}
        {reviewable && <>
          <button type="button" className="primary" disabled={busy || !onSource || !state.analysis} onClick={() => void confirm()}>{busy ? copy.saving : reviewed ? copy.markAgain : copy.markReviewed}</button>
        </>}
        {reviewed && next && nextPositionKey !== positionKey && <Link className="primary-link" href={trainingReviewHref(item!, next)}>{copy.nextPosition}</Link>}
        {reviewed && !next && item && <small role="status">{nextDueNote}</small>}
        {!state.analysis && <small>{copy.analyzeFirst}</small>}
      </>}
      <Link className="text-button" href="/training">{item?.completionKind === "mastered" ? copy.backToPractice : copy.pauseReturn}</Link>
    </div>
    {(error || sourceError) && <p className="error" role="alert">{error ?? sourceError} <button type="button" className="text-button" onClick={() => window.location.reload()}>{copy.reloadTask}</button></p>}
  </section>;
}
