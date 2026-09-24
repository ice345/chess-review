"use client";

import Link from "next/link";
import type { HistoryAnalysisJobV1, HistoryAnalysisScopeV1, SyncedGame } from "@chess-review/shared";
import {
  HISTORY_ANALYSIS_CONCURRENCY,
  isHistoryAnalysisJobFinished,
} from "../../lib/history-analysis-jobs";
import {
  detailedJobCounts,
  explainHistoryAnalysisError,
  gameLabel,
  historyJobPresentation,
  type HistoryJobAction,
} from "./study-helpers";

function HistoryJobCard({
  job,
  games,
  duplicateCount,
  compact = false,
  onControl,
  onRemove,
}: {
  job: HistoryAnalysisJobV1;
  games: readonly SyncedGame[];
  duplicateCount: number;
  compact?: boolean;
  onControl: (job: HistoryAnalysisJobV1, action: HistoryJobAction) => void | Promise<void>;
  onRemove: (job: HistoryAnalysisJobV1) => void | Promise<void>;
}) {
  const counts = detailedJobCounts(job);
  const failedItems = job.items.filter((item) => item.status === "failed");
  const successfulItems = job.items.filter((item) => item.status === "cached" || item.status === "completed");
  const statusLabel = job.supersededBy ? "replaced" : job.status === "failed" && counts.done > 0 ? "partial" : job.status;
  return <article className={`history-job-card ${compact ? "compact" : ""} ${job.status}`}>
    <div className="history-job-heading">
      <div>
        <strong>{statusLabel}</strong>
        <small>{counts.done}/{counts.total} complete · {counts.completed} analyzed · {counts.cached} cache reused{counts.failed > 0 ? ` · ${counts.failed} failed` : ""}{counts.pending > 0 ? ` · ${counts.pending} pending` : ""} · depth {job.depth}</small>
        {(job.excludedItems?.length ?? 0) > 0 && <small>{job.excludedItems!.length} game{job.excludedItems!.length === 1 ? "" : "s"} skipped: provider PGN is invalid and cannot be analyzed.</small>}
        {duplicateCount > 0 && <small>{duplicateCount} duplicate job{duplicateCount === 1 ? "" : "s"} collapsed</small>}
      </div>
      <progress max={Math.max(1, counts.total)} value={counts.done + counts.failed} aria-label={`${counts.done + counts.failed} of ${counts.total} games processed`} />
    </div>
    {counts.done > 0 && <p className="history-job-success">✓ {counts.done} successful analysis{counts.done === 1 ? "" : "es"} already added to Practice{counts.pending > 0 ? "; more results will appear as they finish" : "."}</p>}
    {job.error && <p className={counts.done > 0 ? "history-job-partial" : "history-job-error"}>{job.error}</p>}
    {failedItems.length > 0 && <details className="history-job-details">
      <summary>Why {failedItems.length} game{failedItems.length === 1 ? "" : "s"} failed</summary>
      <ul>{failedItems.map((item) => {
        const explanation = item.error ? explainHistoryAnalysisError(item.error) : null;
        return <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games)}</strong><small>{item.error ?? "No reason was recorded. Retry this item to capture the engine/provider error."}</small>{explanation && <small className="history-job-explanation">{explanation}</small>}</span></li>;
      })}</ul>
    </details>}
    {(job.excludedItems?.length ?? 0) > 0 && <details className="history-job-details">
      <summary>Why {job.excludedItems!.length} game{job.excludedItems!.length === 1 ? "" : "s"} cannot be analyzed</summary>
      <ul>{job.excludedItems!.map((item) => <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games)}</strong><small>Invalid PGN from the provider — {item.reason}. This game is outside chess rules parsing and is not counted as an analysis failure.</small></span></li>)}</ul>
    </details>}
    {successfulItems.length > 0 && <details className="history-job-details">
      <summary>Successful analyses ({successfulItems.length})</summary>
      <ul>{successfulItems.slice(0, compact ? 4 : 12).map((item) => {
        const analysisId = games.find((game) => game.id === item.gameId)?.analysisId ?? item.analysisId;
        return <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games)}</strong><small>{item.status === "cached" ? "Loaded from objective cache." : "Stockfish analysis saved to Practice."}</small></span>{analysisId && <Link href={`/review/${analysisId}`}>Open →</Link>}</li>;
      })}</ul>
      {successfulItems.length > (compact ? 4 : 12) && <small className="history-job-more">+{successfulItems.length - (compact ? 4 : 12)} more successful games</small>}
    </details>}
    <div className="training-actions">
      {job.status === "running" && <button type="button" className="secondary" onClick={() => void onControl(job, "pause")}>Pause</button>}
      {(job.status === "paused" || job.status === "queued") && <button type="button" className="primary" onClick={() => void onControl(job, "resume")}>Resume</button>}
      {job.status === "failed" && <button type="button" className="primary" onClick={() => void onControl(job, "retry")}>Retry failed</button>}
      {!["cancelled", "completed"].includes(job.status) && <button type="button" className="text-button" onClick={() => void onControl(job, "cancel")}>Cancel</button>}
      {isHistoryAnalysisJobFinished(job) && <button type="button" className="text-button" onClick={() => void onRemove(job)}>Remove from history</button>}
    </div>
  </article>;
}

/**
 * Starts or extends objective analysis of the imported games in the current scope.
 * Two surfaces own one of these: the first-run empty state, and the folded Training
 * page of a connected account whose imported games have not been analyzed yet. The
 * copy lives here so the two cannot describe the same action differently.
 */
function HistoryAnalysisControls({ freshness, jobWorking, onFreshness, onStart }: {
  freshness: HistoryAnalysisScopeV1["freshness"];
  jobWorking: boolean;
  onFreshness: (value: HistoryAnalysisScopeV1["freshness"]) => void;
  onStart: () => void;
}) {
  return <>
    <label><span>Freshness</span><select value={freshness} onChange={(event) => onFreshness(event.target.value as HistoryAnalysisScopeV1["freshness"])}><option value="all">All matching (reuse cache)</option><option value="unanalyzed">Never analyzed</option><option value="stale">Stale only</option></select></label>
    <button type="button" className="primary" disabled={jobWorking} onClick={() => void onStart()}>{jobWorking ? "Analyzing…" : "Analyze my history"}</button>
    <small>Background analysis · up to {HISTORY_ANALYSIS_CONCURRENCY} games at once.</small>
  </>;
}

function HistoryJobsPanel({
  groups,
  games,
  onControl,
  onRemove,
  onClear,
}: {
  groups: Array<{ job: HistoryAnalysisJobV1; duplicateCount: number }>;
  games: readonly SyncedGame[];
  onControl: (job: HistoryAnalysisJobV1, action: HistoryJobAction) => void | Promise<void>;
  onRemove: (job: HistoryAnalysisJobV1) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}) {
  const presentation = historyJobPresentation(groups);
  if (groups.length === 0) return null;
  return <>
    <div className="history-run-heading"><span>Analysis runs</span>{groups.some(({ job }) => isHistoryAnalysisJobFinished(job)) && <button type="button" className="text-button" onClick={() => void onClear()}>Clear finished runs</button>}</div>
    {presentation.prominent.length > 0 && <div className="history-job-list">{presentation.prominent.map(({ job, duplicateCount }) => <HistoryJobCard key={job.id} job={job} games={games} duplicateCount={duplicateCount} onControl={onControl} onRemove={onRemove} />)}</div>}
    {presentation.past.length > 0 && <details className="history-past-runs">
      <summary>Past analysis runs · {presentation.past.length}</summary>
      <div className="history-job-list history-job-list-past">{presentation.past.map(({ job, duplicateCount }) => <HistoryJobCard key={job.id} job={job} games={games} duplicateCount={duplicateCount} compact onControl={onControl} onRemove={onRemove} />)}</div>
    </details>}
  </>;
}

export { HistoryJobCard, HistoryAnalysisControls, HistoryJobsPanel };
