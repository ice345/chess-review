"use client";

import Link from "next/link";
import { TrainingQueuePanel } from "../training-queue-panel";
import { TrainingToday } from "../training-today";
import { usePracticeStudy } from "../../hooks/use-practice-study";
import { HistoryAnalysisControls, HistoryJobsPanel } from "./history-jobs";
import { ScopeFilters } from "./scope-filters";

/** Practice hub: chapter progress, rehearsal rhythm, today task, queue. */
export function PracticeStudyPanel() {
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

  return (
    <main className="page-scroll study-page">
      <section className="page-head head-instrument study-heading" aria-label="Practice chapter">
        <div className="practice-chapter-head">
          <p className="page-kicker" data-movement={chapter.movement}>{chapter.kicker}</p>
          {chapter.hasRevisitMark && (
            <span className="practice-revisit-mark" title="Saved or revisit records exist for this player">
              saved · revisit
            </span>
          )}
        </div>
        <h1 className="page-display">Practice</h1>
        <p className="page-lede practice-head-lede">
          {chapter.lede}
          {chapter.nudgeHref && chapter.nudgeLabel ? (
            <>{" "}<Link className="practice-chapter-nudge" href={chapter.nudgeHref}>{chapter.nudgeLabel}</Link></>
          ) : null}
        </p>
        <ol className="practice-score-desk" aria-label="Chapter progress">
          {chapter.steps.map((step) => (
            <li key={step.id} data-step={step.id} data-done={step.done ? "true" : "false"}>
              <span className="practice-score-desk-pip" aria-hidden="true" />
              <span className="practice-score-desk-label">{step.label}</span>
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
        <aside className="practice-method" aria-label="Practice guide">
          <span className="eyebrow">A quiet rehearsal</span>
          <h2>Return to the decision.</h2>
          <ol>
            <li><strong>Observe</strong><span>The board opens before the move was played.</span></li>
            <li><strong>Compare</strong><span>Inspect the played move and Stockfish evidence.</span></li>
            <li><strong>Return</strong><span>Save the review, then revisit it when it is due.</span></li>
          </ol>
          <p>For move-by-move exercises, choose a reviewed game.</p>
          <Link href="/review">Choose a game →</Link>
        </aside>
      </div>
      <TrainingQueuePanel key={playerKey} playerKey={playerKey} />
      {analysisStatus && <p className="study-analysis-status" role="status">{analysisStatus}</p>}
      {notice && <p className="study-notice" role="status">{notice}</p>}
      {loading ? <section className="study-empty">Loading…</section> : (summaries?.length ?? 0) === 0 ? <>
        {accounts.length > 0 && <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} gameCount={scopeGameCount} open={scopeOpen} onToggle={setScopeOpen} />}
        <section className="study-empty"><strong>{jobs.some((job) => job.items.some((item) => item.status === "cached" || item.status === "completed")) ? "Analysis is arriving" : "No current analyses"}</strong><span>{accounts.length > 0 ? `${eligibleSynced.length} synced games match this scope.` : "Sync games or complete an objective review."}</span>{accounts.length === 0 ? <Link className="primary-link" href="/history">Open History</Link> : <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={startHistoryAnalysis} /></div>}{historyJobGroups.length > 0 && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}</section>
      </> : !showStudyReport ? (showRunHistory || canAnalyzeHistory ? <section className="study-runs-only">
        {canAnalyzeHistory && <>
          <div className="history-analysis-heading"><span>Analyse imported games</span></div>
          <p className="quiet-empty">{unanalyzedEligibleCount} of {eligibleSynced.length} imported games in this scope have no objective analysis yet.</p>
          <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={() => startHistoryAnalysis(player?.accountId ? [player.accountId] : selectedAccountIds)} /></div>
        </>}
        {showRunHistory && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}
      </section> : null) : (
        <p className="study-report-kicker"><Link href="/stats">Ratings, openings and mistakes live on Stats →</Link></p>
      )}
    </main>
  );
}
