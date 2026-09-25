"use client";

import Link from "next/link";
import type { HistoryAnalysisJobStatus, HistoryAnalysisJobV1, HistoryAnalysisScopeV1, SyncedGame, UiLanguage } from "@chess-review/shared";
import {
  HISTORY_ANALYSIS_CONCURRENCY,
  isHistoryAnalysisJobFinished,
} from "../../lib/history-analysis-jobs";
import { useUiLanguage } from "../../hooks/use-ui-language";
import {
  detailedJobCounts,
  historyJobPresentation,
  type HistoryJobAction,
} from "./study-helpers";

type JobsCopy = {
  replaced: string;
  partial: string;
  jobStatus: Record<HistoryAnalysisJobStatus, string>;
  counts: (done: number, total: number, completed: number, cached: number, failed: number, pending: number, depth: number) => string;
  skippedInvalid: (n: number) => string;
  duplicatesCollapsed: (n: number) => string;
  processedAria: (done: number, total: number) => string;
  successAdded: (done: number, pending: boolean) => string;
  whyFailed: (n: number) => string;
  noReason: string;
  whyCannotAnalyze: (n: number) => string;
  invalidPgn: (reason: string) => string;
  successfulAnalyses: (n: number) => string;
  loadedCache: string;
  stockfishSaved: string;
  open: string;
  moreSuccessful: (n: number) => string;
  pause: string;
  resume: string;
  retryFailed: string;
  cancel: string;
  removeFromHistory: string;
  freshness: string;
  allMatching: string;
  neverAnalyzed: string;
  staleOnly: string;
  analyzing: string;
  analyzeHistory: string;
  background: (n: number) => string;
  analysisRuns: string;
  clearFinished: string;
  pastRuns: (n: number) => string;
  gameFallback: (id: string) => string;
  vs: (white: string, black: string, date: string) => string;
  errMultiPv: string;
  errNoLine: string;
};

const COPY: Record<UiLanguage, JobsCopy> = {
  en: {
    replaced: "replaced",
    partial: "partial",
    jobStatus: {
      queued: "queued",
      running: "running",
      paused: "paused",
      cancelled: "cancelled",
      failed: "failed",
      completed: "completed",
    },
    counts: (done, total, completed, cached, failed, pending, depth) =>
      `${done}/${total} complete · ${completed} analyzed · ${cached} cache reused${failed > 0 ? ` · ${failed} failed` : ""}${pending > 0 ? ` · ${pending} pending` : ""} · depth ${depth}`,
    skippedInvalid: (n) => `${n} game${n === 1 ? "" : "s"} skipped: provider PGN is invalid and cannot be analyzed.`,
    duplicatesCollapsed: (n) => `${n} duplicate job${n === 1 ? "" : "s"} collapsed`,
    processedAria: (done, total) => `${done} of ${total} games processed`,
    successAdded: (done, pending) =>
      `✓ ${done} successful analysis${done === 1 ? "" : "es"} already added to Practice${pending ? "; more results will appear as they finish" : "."}`,
    whyFailed: (n) => `Why ${n} game${n === 1 ? "" : "s"} failed`,
    noReason: "No reason was recorded. Retry this item to capture the engine/provider error.",
    whyCannotAnalyze: (n) => `Why ${n} game${n === 1 ? "" : "s"} cannot be analyzed`,
    invalidPgn: (reason) => `Invalid PGN from the provider — ${reason}. This game is outside chess rules parsing and is not counted as an analysis failure.`,
    successfulAnalyses: (n) => `Successful analyses (${n})`,
    loadedCache: "Loaded from objective cache.",
    stockfishSaved: "Stockfish analysis saved to Practice.",
    open: "Open →",
    moreSuccessful: (n) => `+${n} more successful games`,
    pause: "Pause",
    resume: "Resume",
    retryFailed: "Retry failed",
    cancel: "Cancel",
    removeFromHistory: "Remove from history",
    freshness: "Freshness",
    allMatching: "All matching (reuse cache)",
    neverAnalyzed: "Never analyzed",
    staleOnly: "Stale only",
    analyzing: "Analyzing…",
    analyzeHistory: "Analyze my history",
    background: (n) => `Background analysis · up to ${n} games at once.`,
    analysisRuns: "Analysis runs",
    clearFinished: "Clear finished runs",
    pastRuns: (n) => `Past analysis runs · ${n}`,
    gameFallback: (id) => `Game ${id.slice(0, 12)}`,
    vs: (white, black, date) => `${white} vs ${black} · ${date}`,
    errMultiPv: "This game is legal, but Stockfish did not return a complete line for the played move. Retry to retrieve the missing objective evidence.",
    errNoLine: "The game passed rules validation, but the engine returned no complete evaluation line. Retry after other browser analysis has stopped.",
  },
  "zh-CN": {
    replaced: "已替换",
    partial: "部分完成",
    jobStatus: {
      queued: "排队中",
      running: "进行中",
      paused: "已暂停",
      cancelled: "已取消",
      failed: "失败",
      completed: "已完成",
    },
    counts: (done, total, completed, cached, failed, pending, depth) =>
      `${done}/${total} 完成 · ${completed} 已分析 · ${cached} 复用缓存${failed > 0 ? ` · ${failed} 失败` : ""}${pending > 0 ? ` · ${pending} 等待中` : ""} · 深度 ${depth}`,
    skippedInvalid: (n) => `跳过 ${n} 盘对局：平台 PGN 无效，无法分析。`,
    duplicatesCollapsed: (n) => `已合并 ${n} 个重复任务`,
    processedAria: (done, total) => `已处理 ${done} / ${total} 盘对局`,
    successAdded: (done, pending) =>
      `✓ ${done} 次成功分析已加入训练${pending ? "；其余结果完成时会继续出现" : "。"}`,
    whyFailed: (n) => `${n} 盘对局失败的原因`,
    noReason: "没有记录原因。请重试此项以捕获引擎/平台错误。",
    whyCannotAnalyze: (n) => `${n} 盘对局无法分析的原因`,
    invalidPgn: (reason) => `平台提供的 PGN 无效 — ${reason}。此对局超出棋规解析范围，不计入分析失败。`,
    successfulAnalyses: (n) => `成功的分析（${n}）`,
    loadedCache: "已从客观缓存加载。",
    stockfishSaved: "Stockfish 分析已保存到训练。",
    open: "打开 →",
    moreSuccessful: (n) => `还有 ${n} 盘成功的对局`,
    pause: "暂停",
    resume: "继续",
    retryFailed: "重试失败项",
    cancel: "取消",
    removeFromHistory: "从历史中移除",
    freshness: "新鲜度",
    allMatching: "全部匹配（复用缓存）",
    neverAnalyzed: "从未分析",
    staleOnly: "仅过期",
    analyzing: "分析中…",
    analyzeHistory: "分析我的历史",
    background: (n) => `后台分析 · 最多同时 ${n} 盘。`,
    analysisRuns: "分析任务",
    clearFinished: "清除已完成的任务",
    pastRuns: (n) => `以往分析任务 · ${n}`,
    gameFallback: (id) => `对局 ${id.slice(0, 12)}`,
    vs: (white, black, date) => `${white} 对 ${black} · ${date}`,
    errMultiPv: "此对局合法，但 Stockfish 没有为实战着法返回完整变化。请重试以取得缺失的客观证据。",
    errNoLine: "对局通过了棋规校验，但引擎没有返回完整评分变化。请等其他浏览器分析结束后再重试。",
  },
};

function gameLabel(gameId: string, games: readonly SyncedGame[], copy: JobsCopy): string {
  const game = games.find((item) => item.id === gameId);
  if (!game) return copy.gameFallback(gameId);
  return copy.vs(game.white.username, game.black.username, new Date(game.playedAt).toLocaleDateString());
}

function explainHistoryAnalysisError(error: string, copy: JobsCopy): string | null {
  if (/outside MultiPV/i.test(error)) return copy.errMultiPv;
  if (/no scored principal variation|completed line|worker exited/i.test(error)) return copy.errNoLine;
  return null;
}

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
  const copy = COPY[useUiLanguage()];
  const counts = detailedJobCounts(job);
  const failedItems = job.items.filter((item) => item.status === "failed");
  const successfulItems = job.items.filter((item) => item.status === "cached" || item.status === "completed");
  const statusLabel = job.supersededBy ? copy.replaced : job.status === "failed" && counts.done > 0 ? copy.partial : copy.jobStatus[job.status];
  return <article className={`history-job-card ${compact ? "compact" : ""} ${job.status}`}>
    <div className="history-job-heading">
      <div>
        <strong>{statusLabel}</strong>
        <small>{copy.counts(counts.done, counts.total, counts.completed, counts.cached, counts.failed, counts.pending, job.depth)}</small>
        {(job.excludedItems?.length ?? 0) > 0 && <small>{copy.skippedInvalid(job.excludedItems!.length)}</small>}
        {duplicateCount > 0 && <small>{copy.duplicatesCollapsed(duplicateCount)}</small>}
      </div>
      <progress max={Math.max(1, counts.total)} value={counts.done + counts.failed} aria-label={copy.processedAria(counts.done + counts.failed, counts.total)} />
    </div>
    {counts.done > 0 && <p className="history-job-success">{copy.successAdded(counts.done, counts.pending > 0)}</p>}
    {job.error && <p className={counts.done > 0 ? "history-job-partial" : "history-job-error"}>{job.error}</p>}
    {failedItems.length > 0 && <details className="history-job-details">
      <summary>{copy.whyFailed(failedItems.length)}</summary>
      <ul>{failedItems.map((item) => {
        const explanation = item.error ? explainHistoryAnalysisError(item.error, copy) : null;
        return <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games, copy)}</strong><small>{item.error ?? copy.noReason}</small>{explanation && <small className="history-job-explanation">{explanation}</small>}</span></li>;
      })}</ul>
    </details>}
    {(job.excludedItems?.length ?? 0) > 0 && <details className="history-job-details">
      <summary>{copy.whyCannotAnalyze(job.excludedItems!.length)}</summary>
      <ul>{job.excludedItems!.map((item) => <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games, copy)}</strong><small>{copy.invalidPgn(item.reason)}</small></span></li>)}</ul>
    </details>}
    {successfulItems.length > 0 && <details className="history-job-details">
      <summary>{copy.successfulAnalyses(successfulItems.length)}</summary>
      <ul>{successfulItems.slice(0, compact ? 4 : 12).map((item) => {
        const analysisId = games.find((game) => game.id === item.gameId)?.analysisId ?? item.analysisId;
        return <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games, copy)}</strong><small>{item.status === "cached" ? copy.loadedCache : copy.stockfishSaved}</small></span>{analysisId && <Link href={`/review/${analysisId}`}>{copy.open}</Link>}</li>;
      })}</ul>
      {successfulItems.length > (compact ? 4 : 12) && <small className="history-job-more">{copy.moreSuccessful(successfulItems.length - (compact ? 4 : 12))}</small>}
    </details>}
    <div className="training-actions">
      {job.status === "running" && <button type="button" className="secondary" onClick={() => void onControl(job, "pause")}>{copy.pause}</button>}
      {(job.status === "paused" || job.status === "queued") && <button type="button" className="primary" onClick={() => void onControl(job, "resume")}>{copy.resume}</button>}
      {job.status === "failed" && <button type="button" className="primary" onClick={() => void onControl(job, "retry")}>{copy.retryFailed}</button>}
      {!["cancelled", "completed"].includes(job.status) && <button type="button" className="text-button" onClick={() => void onControl(job, "cancel")}>{copy.cancel}</button>}
      {isHistoryAnalysisJobFinished(job) && <button type="button" className="text-button" onClick={() => void onRemove(job)}>{copy.removeFromHistory}</button>}
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
  const copy = COPY[useUiLanguage()];
  return <>
    <label><span>{copy.freshness}</span><select value={freshness} onChange={(event) => onFreshness(event.target.value as HistoryAnalysisScopeV1["freshness"])}><option value="all">{copy.allMatching}</option><option value="unanalyzed">{copy.neverAnalyzed}</option><option value="stale">{copy.staleOnly}</option></select></label>
    <button type="button" className="primary" disabled={jobWorking} onClick={() => void onStart()}>{jobWorking ? copy.analyzing : copy.analyzeHistory}</button>
    <small>{copy.background(HISTORY_ANALYSIS_CONCURRENCY)}</small>
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
  const copy = COPY[useUiLanguage()];
  const presentation = historyJobPresentation(groups);
  if (groups.length === 0) return null;
  return <>
    <div className="history-run-heading"><span>{copy.analysisRuns}</span>{groups.some(({ job }) => isHistoryAnalysisJobFinished(job)) && <button type="button" className="text-button" onClick={() => void onClear()}>{copy.clearFinished}</button>}</div>
    {presentation.prominent.length > 0 && <div className="history-job-list">{presentation.prominent.map(({ job, duplicateCount }) => <HistoryJobCard key={job.id} job={job} games={games} duplicateCount={duplicateCount} onControl={onControl} onRemove={onRemove} />)}</div>}
    {presentation.past.length > 0 && <details className="history-past-runs">
      <summary>{copy.pastRuns(presentation.past.length)}</summary>
      <div className="history-job-list history-job-list-past">{presentation.past.map(({ job, duplicateCount }) => <HistoryJobCard key={job.id} job={job} games={games} duplicateCount={duplicateCount} compact onControl={onControl} onRemove={onRemove} />)}</div>
    </details>}
  </>;
}

export { HistoryJobCard, HistoryAnalysisControls, HistoryJobsPanel };
