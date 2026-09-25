"use client";

import Link from "next/link";
import type { UiLanguage } from "@chess-review/shared";
import type { PracticeChapterStepId, PracticeMovementTitle } from "../../lib/practice-chapter";
import { useUiLanguage } from "../../hooks/use-ui-language";
import { TrainingQueuePanel } from "../training-queue-panel";
import { TrainingToday } from "../training-today";
import { usePracticeStudy } from "../../hooks/use-practice-study";
import { HistoryAnalysisControls, HistoryJobsPanel } from "./history-jobs";
import { ScopeFilters } from "./scope-filters";

type PracticeCopy = {
  chapterAria: string;
  revisitTitle: string;
  revisitMark: string;
  heading: string;
  progressAria: string;
  kicker: (movement: string, title: string) => string;
  movement: Record<PracticeMovementTitle, string>;
  steps: Record<PracticeChapterStepId, string>;
  ledeBegin: string;
  ledeObserveReview: string;
  ledeObserveHistory: string;
  ledeReturn: string;
  importGame: string;
  openReview: string;
  reviewAnalyse: string;
  guideAria: string;
  quietRehearsal: string;
  returnDecision: string;
  observe: string;
  observeDetail: string;
  compare: string;
  compareDetail: string;
  returnStep: string;
  returnDetail: string;
  chooseReviewed: string;
  chooseGame: string;
  loading: string;
  analysisArriving: string;
  noAnalyses: string;
  syncedMatch: (n: number) => string;
  syncOrReview: string;
  openHistory: string;
  analyseImported: string;
  unanalyzed: (n: number, total: number) => string;
  statsLink: string;
};

const COPY: Record<UiLanguage, PracticeCopy> = {
  en: {
    chapterAria: "Practice chapter",
    revisitTitle: "Saved or revisit records exist for this player",
    revisitMark: "saved · revisit",
    heading: "Practice",
    progressAria: "Chapter progress",
    kicker: (movement, title) => `MOVEMENT ${movement} ——— ${title}`,
    movement: { BEGIN: "BEGIN", OBSERVE: "OBSERVE", RETURN: "RETURN" },
    steps: { import: "Import", observe: "Observe", attempt: "Attempt", save: "Save", revisit: "Revisit" },
    ledeBegin: "Bring a game to your desk.",
    ledeObserveReview: "Observe a decision in Review before practice can begin.",
    ledeObserveHistory: "Imported games are waiting to be observed.",
    ledeReturn: "Return to the decision you missed.",
    importGame: "Import a game →",
    openReview: "Open Review →",
    reviewAnalyse: "Review / analyse →",
    guideAria: "Practice guide",
    quietRehearsal: "A quiet rehearsal",
    returnDecision: "Return to the decision.",
    observe: "Observe",
    observeDetail: "The board opens before the move was played.",
    compare: "Compare",
    compareDetail: "Inspect the played move and Stockfish evidence.",
    returnStep: "Return",
    returnDetail: "Save the review, then revisit it when it is due.",
    chooseReviewed: "For move-by-move exercises, choose a reviewed game.",
    chooseGame: "Choose a game →",
    loading: "Loading…",
    analysisArriving: "Analysis is arriving",
    noAnalyses: "No current analyses",
    syncedMatch: (n) => `${n} synced games match this scope.`,
    syncOrReview: "Sync games or complete an objective review.",
    openHistory: "Open History",
    analyseImported: "Analyse imported games",
    unanalyzed: (n, total) => `${n} of ${total} imported games in this scope have no objective analysis yet.`,
    statsLink: "Ratings, openings and mistakes live on Stats →",
  },
  "zh-CN": {
    chapterAria: "训练章节",
    revisitTitle: "此棋手有已保存或回访记录",
    revisitMark: "已保存 · 回访",
    heading: "训练",
    progressAria: "章节进度",
    kicker: (movement, title) => `乐章 ${movement} ——— ${title}`,
    movement: { BEGIN: "起始", OBSERVE: "观察", RETURN: "回访" },
    steps: { import: "导入", observe: "观察", attempt: "尝试", save: "保存", revisit: "回访" },
    ledeBegin: "把一盘对局带到你的桌上。",
    ledeObserveReview: "先在复盘中观察一个决定，训练才能开始。",
    ledeObserveHistory: "已导入的对局正等待被观察。",
    ledeReturn: "回到你错过的那个决定。",
    importGame: "导入对局 →",
    openReview: "打开复盘 →",
    reviewAnalyse: "复盘 / 分析 →",
    guideAria: "训练指引",
    quietRehearsal: "安静的排练",
    returnDecision: "回到那个决定。",
    observe: "观察",
    observeDetail: "棋盘停在那步棋走出之前。",
    compare: "比较",
    compareDetail: "查看实战着法和 Stockfish 证据。",
    returnStep: "回来",
    returnDetail: "保存这次复盘，到期时再回来。",
    chooseReviewed: "若要逐步练习，请选择一盘已复盘的对局。",
    chooseGame: "选择一盘对局 →",
    loading: "加载中…",
    analysisArriving: "分析正在到来",
    noAnalyses: "暂无当前分析",
    syncedMatch: (n) => `${n} 盘已同步对局符合此范围。`,
    syncOrReview: "同步对局，或完成一次客观复盘。",
    openHistory: "打开棋库",
    analyseImported: "分析已导入的对局",
    unanalyzed: (n, total) => `此范围内 ${total} 盘已导入对局中，有 ${n} 盘尚未完成客观分析。`,
    statsLink: "等级分、开局和失误在统计页 →",
  },
};

/** Practice hub: chapter progress, rehearsal rhythm, today task, queue. */
export function PracticeStudyPanel() {
  const copy = COPY[useUiLanguage()];
  const study = usePracticeStudy();
  const {
    playerKey,
    player,
    accounts,
    syncedGames,
    jobs,
    filters,
    setFilters,
    scopeOpen,
    setScopeOpen,
    freshness,
    setFreshness,
    workingItem,
    jobWorking,
    notice,
    timeClasses,
    openingOptions,
    selectedAccountIds,
    eligibleSynced,
    historyJobGroups,
    startHistoryAnalysis,
    controlJob,
    removeHistoryRun,
    clearFinishedRuns,
    addWeakness,
    loading,
    retryTrainingToday,
    todayState,
    todayTask,
    analysisStatus,
    scopeGameCount,
    report,
    chapter,
    lastAnalyzedReviewHref,
    playerSelect,
    focusedTaskId,
    showStudyReport,
    showRunHistory,
    canAnalyzeHistory,
    unanalyzedEligibleCount,
    mistakeCount,
    summaries,
  } = study;

  const lede = chapter.movement === "I"
    ? copy.ledeBegin
    : chapter.movement === "III"
      ? copy.ledeReturn
      : chapter.nudgeHref === "/review"
        ? copy.ledeObserveReview
        : copy.ledeObserveHistory;
  const nudgeLabel = chapter.nudgeHref === "/import"
    ? copy.importGame
    : chapter.nudgeHref === "/review"
      ? copy.openReview
      : chapter.nudgeHref === "/history"
        ? copy.reviewAnalyse
        : undefined;

  return (
    <main className="page-scroll study-page">
      <section className="page-head head-instrument study-heading" aria-label={copy.chapterAria}>
        <div className="practice-chapter-head">
          <p className="page-kicker" data-movement={chapter.movement}>{copy.kicker(chapter.movement, copy.movement[chapter.title])}</p>
          {chapter.hasRevisitMark && (
            <span className="practice-revisit-mark" title={copy.revisitTitle}>
              {copy.revisitMark}
            </span>
          )}
        </div>
        <h1 className="page-display">{copy.heading}</h1>
        <p className="page-lede practice-head-lede">
          {lede}
          {chapter.nudgeHref && nudgeLabel ? (
            <>{" "}<Link className="practice-chapter-nudge" href={chapter.nudgeHref}>{nudgeLabel}</Link></>
          ) : null}
        </p>
        <ol className="practice-score-desk" aria-label={copy.progressAria}>
          {chapter.steps.map((step) => (
            <li key={step.id} data-step={step.id} data-done={step.done ? "true" : "false"}>
              <span className="practice-score-desk-pip" aria-hidden="true" />
              <span className="practice-score-desk-label">{copy.steps[step.id]}</span>
            </li>
          ))}
        </ol>
        {playerSelect}
      </section>
      <div className="practice-rehearsal">
        <TrainingToday
          state={todayState}
          task={todayTask}
          plan={report?.trainingPlan ?? []}
          topWeakness={report?.weaknesses[0]}
          focusedFromLink={focusedTaskId !== "" && todayTask?.id === focusedTaskId}
          onAddFocus={(weakness) => void addWeakness(weakness)}
          onRetry={retryTrainingToday}
          disabled={!player || workingItem !== null}
          emptyKind={chapter.emptyKind}
          mistakeCount={mistakeCount}
          {...(lastAnalyzedReviewHref ? { lastReviewHref: lastAnalyzedReviewHref } : {})}
        />
        <aside className="practice-method" aria-label={copy.guideAria}>
          <span className="eyebrow">{copy.quietRehearsal}</span>
          <h2>{copy.returnDecision}</h2>
          <ol>
            <li><strong>{copy.observe}</strong><span>{copy.observeDetail}</span></li>
            <li><strong>{copy.compare}</strong><span>{copy.compareDetail}</span></li>
            <li><strong>{copy.returnStep}</strong><span>{copy.returnDetail}</span></li>
          </ol>
          <p>{copy.chooseReviewed}</p>
          <Link href="/review">{copy.chooseGame}</Link>
        </aside>
      </div>
      <TrainingQueuePanel key={playerKey} playerKey={playerKey} />
      {analysisStatus && <p className="study-analysis-status" role="status">{analysisStatus}</p>}
      {notice && <p className="study-notice" role="status">{notice}</p>}
      {loading ? <section className="study-empty">{copy.loading}</section> : (summaries?.length ?? 0) === 0 ? <>
        {accounts.length > 0 && <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} gameCount={scopeGameCount} open={scopeOpen} onToggle={setScopeOpen} />}
        <section className="study-empty"><strong>{jobs.some((job) => job.items.some((item) => item.status === "cached" || item.status === "completed")) ? copy.analysisArriving : copy.noAnalyses}</strong><span>{accounts.length > 0 ? copy.syncedMatch(eligibleSynced.length) : copy.syncOrReview}</span>{accounts.length === 0 ? <Link className="primary-link" href="/history">{copy.openHistory}</Link> : <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={startHistoryAnalysis} /></div>}{historyJobGroups.length > 0 && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}</section>
      </> : !showStudyReport ? (showRunHistory || canAnalyzeHistory ? <section className="study-runs-only">
        {canAnalyzeHistory && <>
          <div className="history-analysis-heading"><span>{copy.analyseImported}</span></div>
          <p className="quiet-empty">{copy.unanalyzed(unanalyzedEligibleCount, eligibleSynced.length)}</p>
          <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={() => startHistoryAnalysis(player?.accountId ? [player.accountId] : selectedAccountIds)} /></div>
        </>}
        {showRunHistory && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}
      </section> : null) : (
        <p className="study-report-kicker"><Link href="/stats">{copy.statsLink}</Link></p>
      )}
    </main>
  );
}
