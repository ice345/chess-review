"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAdvancedStudyReportV2,
  listStudyOpeningFilterOptionsV2,
  OBJECTIVE_ALGORITHM_VERSION,
  studyGameMatchesFilters,
  type RecurringWeakness,
  type StudyGameInputV2,
  type StudyReportFiltersV2,
} from "@chess-review/analysis";
import type {
  HistoryAnalysisJobV1,
  HistoryAnalysisScopeV1,
  PlatformAccount,
  StudyWeaknessKind,
  SyncedGame,
  TrainingQueueItemV3,
} from "@chess-review/shared";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";
import { AppHeader } from "./app-header";
import { TrainingQueuePanel } from "./training-queue-panel";
import { TrainingToday } from "./training-today";
import { subscribeLocalData } from "../lib/browser-storage";
import {
  loadStudyPlayerLibrary,
  loadStudyPlayerSummaries,
  type StudyPlayerLibrary,
  type StudyPlayerSummary,
} from "../lib/advanced-study-library";
import { listAnalysisCacheProjections } from "../lib/analysis-cache";
import { loadAppSettings } from "../lib/app-settings";
import {
  cancelHistoryAnalysisJob,
  clearFinishedHistoryAnalysisJobs,
  createOrReuseHistoryAnalysisJob,
  HISTORY_ANALYSIS_CONCURRENCY,
  isHistoryAnalysisJobFinished,
  listHistoryAnalysisJobs,
  pauseHistoryAnalysisJob,
  recoverInterruptedHistoryJobs,
  removeHistoryAnalysisJob,
  retryFailedHistoryAnalysisItems,
  runHistoryAnalysisJob,
} from "../lib/history-analysis-jobs";
import { listPlatformAccounts, listSyncedGames } from "../lib/platform-library";
import { createTrainingQueueItem, listTrainingQueue, saveTrainingQueueItem, todaysTrainingTask, trainingQueueItemId } from "../lib/training-queue";

type QueueItem = TrainingQueueItemV3;
type StudyTab = "overview" | "ratings" | "openings" | "middlegame" | "endgame" | "mistakes" | "highlights" | "plan" | "coverage";

const NAV_GROUPS: Array<{ id: string; label?: string; tabs: Array<{ id: StudyTab; label: string }> }> = [
  { id: "overview", tabs: [{ id: "overview", label: "Overview" }] },
  { id: "analysis", label: "Analysis", tabs: [
    { id: "ratings", label: "Rating" },
    { id: "openings", label: "Openings" },
    { id: "middlegame", label: "Middlegame" },
    { id: "endgame", label: "Endgame" },
  ] },
  { id: "improvement", label: "Improvement", tabs: [
    { id: "mistakes", label: "Mistakes" },
    { id: "highlights", label: "Highlights" },
    { id: "plan", label: "Plan" },
  ] },
  { id: "data", label: "Data", tabs: [{ id: "coverage", label: "Coverage" }] },
];

const WEAKNESS_COPY: Record<StudyWeaknessKind, { title: string; description: string }> = {
  "opening-decisions": { title: "Opening decisions", description: "Repeated objective errors in opening positions." },
  "middlegame-decisions": { title: "Middlegame decisions", description: "Repeated objective errors in middlegame positions." },
  "endgame-decisions": { title: "Endgame decisions", description: "Repeated objective errors after the structural endgame boundary." },
  "missed-opportunities": { title: "Missed opportunities", description: "Repeated verified missed-win or missed-mate evidence." },
};

const DEFAULT_FILTERS: StudyReportFiltersV2 = {
  providers: [],
  timeClasses: [],
  rated: "all",
  playerColors: [],
  openingKeys: [],
  minimumSampleSize: 1,
};

function formatted(value: number | undefined, suffix = ""): string {
  return value === undefined ? "—" : `${value.toFixed(1)}${suffix}`;
}

function detailedJobCounts(job: HistoryAnalysisJobV1) {
  const cached = job.items.filter((item) => item.status === "cached").length;
  const completed = job.items.filter((item) => item.status === "completed").length;
  const failed = job.items.filter((item) => item.status === "failed").length;
  const pending = job.items.filter((item) => item.status === "queued" || item.status === "running").length;
  return { cached, completed, failed, pending, done: cached + completed, total: job.items.length };
}

function liveAnalysisStatus(jobs: readonly HistoryAnalysisJobV1[]): string | null {
  const live = jobs.find((job) => !job.supersededBy && ["running", "queued", "paused"].includes(job.status));
  if (!live) return null;
  const counts = detailedJobCounts(live);
  const excluded = live.excludedItems?.length ?? 0;
  const phase = live.status === "running" ? "analysis running" : live.status === "paused" ? "paused" : "waiting to start";
  return `${counts.done} / ${counts.total} games analyzed · ${phase}${excluded > 0 ? ` · ${excluded} excluded` : ""}`;
}

function gameLabel(gameId: string, games: readonly SyncedGame[]): string {
  const game = games.find((item) => item.id === gameId);
  if (!game) return `Game ${gameId.slice(0, 12)}`;
  return `${game.white.username} vs ${game.black.username} · ${new Date(game.playedAt).toLocaleDateString()}`;
}

function historyJobSignature(job: HistoryAnalysisJobV1): string {
  return JSON.stringify({
    scope: job.scope,
    depth: job.depth,
    objectiveAlgorithmVersion: job.objectiveAlgorithmVersion,
    classificationMultiPv: job.classificationMultiPv,
    games: job.items.map((item) => item.gameId).sort(),
  });
}

function collapseHistoryJobs(jobs: readonly HistoryAnalysisJobV1[]): Array<{ job: HistoryAnalysisJobV1; duplicateCount: number }> {
  const groups = new Map<string, { job: HistoryAnalysisJobV1; duplicateCount: number }>();
  for (const job of jobs) {
    const key = historyJobSignature(job);
    const existing = groups.get(key);
    if (existing) existing.duplicateCount += 1;
    else groups.set(key, { job, duplicateCount: 0 });
  }
  return [...groups.values()];
}

type HistoryJobAction = "pause" | "resume" | "cancel" | "retry";

function explainHistoryAnalysisError(error: string): string | null {
  if (/outside MultiPV/i.test(error)) {
    return "This game is legal, but Stockfish did not return a complete line for the played move. Retry to retrieve the missing objective evidence.";
  }
  if (/no scored principal variation|completed line|worker exited/i.test(error)) {
    return "The game passed rules validation, but the engine returned no complete evaluation line. Retry after other browser analysis has stopped.";
  }
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
    {counts.done > 0 && <p className="history-job-success">✓ {counts.done} successful analysis{counts.done === 1 ? "" : "es"} already added to Training{counts.pending > 0 ? "; more results will appear as they finish" : "."}</p>}
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
        return <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games)}</strong><small>{item.status === "cached" ? "Loaded from objective cache." : "Stockfish analysis saved to Training."}</small></span>{analysisId && <Link href={`/review/${analysisId}`}>Open →</Link>}</li>;
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

function scopeLabel(filters: StudyReportFiltersV2, gameCount: number): string {
  const provider = filters.providers.length === 0
    ? "All platforms"
    : filters.providers.map((value) => value === "chesscom" ? "Chess.com" : "Lichess").join(" + ");
  const time = filters.timeClasses.length === 0 ? "All time controls" : filters.timeClasses.join(" + ");
  const color = filters.playerColors.length === 0
    ? "Both colors"
    : filters.playerColors.map((value) => value === "white" ? "White" : "Black").join(" + ");
  const rated = filters.rated === "all" ? "All games" : filters.rated === "rated" ? "Rated" : "Casual";
  const dates = filters.dateFrom || filters.dateTo ? " · Date range" : "";
  return provider + " · " + time + " · " + rated + " · " + color + dates + " · " + gameCount + " games";
}

function ScopeFilters({
  filters,
  setFilters,
  timeClasses,
  openingOptions,
  gameCount,
  open,
  onToggle,
}: {
  filters: StudyReportFiltersV2;
  setFilters: (filters: StudyReportFiltersV2) => void;
  timeClasses: string[];
  openingOptions: Array<{ key: string; label: string }>;
  gameCount: number;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return <details className="study-scope" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
    <summary><span>Scope</span><strong>{scopeLabel(filters, gameCount)}</strong><span className="study-scope-change">{open ? "Hide scope" : "Change scope"}</span></summary>
    <div className="study-filters" aria-label="Study population filters">
    <label><span>Source</span><select value={filters.providers[0] ?? "all"} onChange={(event) => setFilters({ ...filters, providers: event.target.value === "all" ? [] : [event.target.value as "chesscom" | "lichess"] })}><option value="all">All sources</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label>
    <label><span>Time control</span><select value={filters.timeClasses[0] ?? "all"} onChange={(event) => setFilters({ ...filters, timeClasses: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">All time controls</option>{timeClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>Rated</span><select value={filters.rated} onChange={(event) => setFilters({ ...filters, rated: event.target.value as StudyReportFiltersV2["rated"] })}><option value="all">All games</option><option value="rated">Rated</option><option value="casual">Casual</option></select></label>
    <label><span>Color</span><select value={filters.playerColors[0] ?? "all"} onChange={(event) => setFilters({ ...filters, playerColors: event.target.value === "all" ? [] : [event.target.value as "white" | "black"] })}><option value="all">Both colors</option><option value="white">White</option><option value="black">Black</option></select></label>
    <label><span>Opening</span><select value={filters.openingKeys[0] ?? "all"} disabled={openingOptions.length === 0} onChange={(event) => setFilters({ ...filters, openingKeys: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">All openings</option>{openingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    <label><span>Minimum sample</span><select value={filters.minimumSampleSize} onChange={(event) => setFilters({ ...filters, minimumSampleSize: Number(event.target.value) })}>{[1, 2, 3, 5, 10].map((value) => <option key={value} value={value}>{value} game{value === 1 ? "" : "s"}</option>)}</select></label>
    <label><span>From</span><input type="date" value={filters.dateFrom?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateFrom = `${event.target.value}T00:00:00.000Z`; else delete next.dateFrom; setFilters(next); }} /></label>
    <label><span>To</span><input type="date" value={filters.dateTo?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateTo = `${event.target.value}T23:59:59.999Z`; else delete next.dateTo; setFilters(next); }} /></label>
    </div>
  </details>;
}

function historyJobPresentation(groups: Array<{ job: HistoryAnalysisJobV1; duplicateCount: number }>) {
  const current = groups.filter(({ job }) => !job.supersededBy);
  const active = current.filter(({ job }) => ["running", "queued", "paused"].includes(job.status));
  const errors = current.filter(({ job }) => job.status === "failed");
  const latestFinished = current.find(({ job }) => job.status === "completed" || job.status === "cancelled");
  const prominentIds = new Set([
    ...active.map(({ job }) => job.id),
    ...errors.map(({ job }) => job.id),
    ...(latestFinished ? [latestFinished.job.id] : []),
  ]);
  return {
    prominent: current.filter(({ job }) => prominentIds.has(job.id)),
    past: groups.filter(({ job }) => !prominentIds.has(job.id)),
  };
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

export function AdvancedStudyPage() {
  const settings = useMemo(() => loadAppSettings(), []);
  // The end-of-review handoff names the player scope and the task it created, so
  // the visitor lands on the work rather than on the report it came from.
  const searchParams = useSearchParams();
  const scopedPlayerKey = searchParams.get("player") ?? "";
  const focusedTaskId = searchParams.get("task") ?? "";
  const [summaries, setSummaries] = useState<StudyPlayerSummary[] | null>(null);
  const [playerKey, setPlayerKey] = useState("");
  const [player, setPlayer] = useState<StudyPlayerLibrary | null>(null);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [syncedGames, setSyncedGames] = useState<SyncedGame[]>([]);
  const [jobs, setJobs] = useState<HistoryAnalysisJobV1[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filters, setFiltersState] = useState<StudyReportFiltersV2>(DEFAULT_FILTERS);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudyTab>("overview");
  const [listLimit, setListLimit] = useState(12);
  const [freshness, setFreshness] = useState<HistoryAnalysisScopeV1["freshness"]>("all");
  const [jobAccountScope, setJobAccountScope] = useState<"selected" | "all">("all");

  const [cacheBytes, setCacheBytes] = useState(0);
  // What the training entry point may claim. It must not say "nothing to train"
  // while the queue is still being read, or when reading it failed.
  const [queueState, setQueueState] = useState<"loading" | "ready" | "failed">("loading");
  const [sourcesFailed, setSourcesFailed] = useState(false);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [jobWorking, setJobWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [playerRevision, setPlayerRevision] = useState(0);
  const queueWorking = useRef(false);
  // Keep an explicit user choice stable, but allow a connected account to
  // replace a temporary manual default when background analysis finishes.
  const playerSelectionTouched = useRef(false);
  const previousActiveJobs = useRef<string | null>(null);
  // The queue is re-read on every data change; only a new population starts a
  // fresh load, so a background refresh cannot flash the loading copy.
  const loadedQueueKey = useRef<string | null>(null);

  const refreshJobs = useCallback(async () => {
    setJobs(await listHistoryAnalysisJobs());
  }, []);

  const refreshSources = useCallback(async () => {
    const nextSummaries = await loadStudyPlayerSummaries();
    const [nextAccounts, nextGames, nextJobs, projections] = await Promise.all([
      listPlatformAccounts(),
      listSyncedGames(),
      recoverInterruptedHistoryJobs(),
      listAnalysisCacheProjections(),
    ]);
    setSummaries(nextSummaries);
    setAccounts(nextAccounts);
    setSyncedGames(nextGames);
    setJobs(nextJobs);
    setCacheBytes(projections.reduce((sum, item) => sum + item.approximateBytes, 0));
    setPlayerKey((current) => {
      const hasCurrent = current !== "" && nextSummaries.some(({ key }) => key === current);
      if (hasCurrent && !(current.startsWith("manual:") && !playerSelectionTouched.current)) return current;
      // An explicit ?player= wins over the automatic pick, once, and only while
      // that population still exists.
      if (scopedPlayerKey !== "" && nextSummaries.some(({ key }) => key === scopedPlayerKey)) {
        playerSelectionTouched.current = true;
        return scopedPlayerKey;
      }
      return nextSummaries.find(({ kind }) => kind === "connected-account")?.key ?? nextSummaries[0]?.key ?? "";
    });
    setPlayerRevision((current) => current + 1);
    setSourcesFailed(false);
  }, [scopedPlayerKey]);

  useEffect(() => {
    void refreshSources().catch((error) => {
      setSummaries([]);
      setSourcesFailed(true);
      setNotice(error instanceof Error ? error.message : "Unable to load training data.");
    });
  }, [refreshSources]);

  useEffect(() => {
    setFiltersState((current) => current.openingKeys.length === 0 ? current : { ...current, openingKeys: [] });
  }, [playerKey]);

  useEffect(() => {
    setListLimit(12);
  }, [activeTab]);

  function selectView(tab: StudyTab) {
    setActiveTab(tab);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  useEffect(() => {
    let active = true;
    if (!playerKey) {
      setPlayer(null);
      setQueue([]);
      loadedQueueKey.current = null;
      // No population means nothing is pending: leave the entry point able to
      // say there is nothing to train instead of claiming it is still reading.
      setQueueState("ready");
      return;
    }
    if (loadedQueueKey.current !== playerKey) setQueueState("loading");
    void Promise.all([loadStudyPlayerLibrary(playerKey), listTrainingQueue(playerKey)]).then(([library, items]) => {
      if (!active) return;
      setPlayer(library);
      setQueue(items);
      loadedQueueKey.current = playerKey;
      setQueueState("ready");
    }).catch((error) => {
      if (!active) return;
      setQueueState("failed");
      setNotice(error instanceof Error ? error.message : "Unable to load this player.");
    });
    const unsubscribe = subscribeLocalData(() => { void listTrainingQueue(playerKey).then((items) => { if (active) { setQueue(items); loadedQueueKey.current = playerKey; setQueueState("ready"); } }).catch((error) => { if (active) { setQueueState("failed"); setNotice(String(error)); } }); });
    return () => { active = false; unsubscribe(); };
  }, [playerKey, playerRevision]);

  const hasActiveHistoryJob = jobs.some((job) => !job.supersededBy && (job.status === "running" || job.status === "queued"));
  const activeJobSignature = jobs
    .filter((job) => !job.supersededBy && (job.status === "running" || job.status === "queued"))
    .map((job) => job.id)
    .sort()
    .join("|");

  useEffect(() => {
    if (!hasActiveHistoryJob) return;
    const jobTimer = window.setInterval(() => {
      void refreshJobs().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to refresh analysis progress."));
    }, 1500);
    const reportTimer = window.setInterval(() => {
      void refreshSources().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to refresh training reports."));
    }, 8000);
    return () => {
      window.clearInterval(jobTimer);
      window.clearInterval(reportTimer);
    };
  }, [hasActiveHistoryJob, refreshJobs, refreshSources]);

  useEffect(() => {
    if (previousActiveJobs.current === null) {
      previousActiveJobs.current = activeJobSignature;
      return;
    }
    if (previousActiveJobs.current !== "" && activeJobSignature === "") {
      void refreshSources().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to refresh completed analyses."));
    }
    previousActiveJobs.current = activeJobSignature;
  }, [activeJobSignature, refreshSources]);

  const timeClasses = useMemo(() => [...new Set(player
    ? player.games.flatMap((game) => game.source?.timeClass ?? [])
    : syncedGames.flatMap((game) => game.timeClass ?? []))].sort(), [player, syncedGames]);
  const compatibleGames = useMemo(() => (player?.games ?? []).filter((game): game is StudyGameInputV2 => game.analysis.version === 2), [player]);
  const openingOptions = useMemo(() => listStudyOpeningFilterOptionsV2(compatibleGames), [compatibleGames]);
  const selectedAccountIds = useMemo(() => jobAccountScope === "all"
    ? accounts.map((account) => account.id)
    : player?.accountId ? [player.accountId] : [], [accounts, jobAccountScope, player?.accountId]);
  const coverageAccountIds = useMemo(() => player?.kind === "connected-account" && player.accountId
    ? [player.accountId]
    : selectedAccountIds, [player, selectedAccountIds]);
  const eligibleSynced = useMemo(() => syncedGames.filter((game) => {
    if (coverageAccountIds.length > 0 && !coverageAccountIds.includes(game.external.accountId)) return false;
    if (filters.providers.length > 0 && !filters.providers.includes(game.external.provider)) return false;
    if (filters.timeClasses.length > 0 && (!game.timeClass || !filters.timeClasses.includes(game.timeClass))) return false;
    if (filters.rated === "rated" && game.rated !== true) return false;
    if (filters.rated === "casual" && game.rated !== false) return false;
    if (filters.playerColors.length > 0 && !filters.playerColors.includes(game.accountColor)) return false;
    if (filters.dateFrom && game.playedAt < filters.dateFrom) return false;
    if (filters.dateTo && game.playedAt > filters.dateTo) return false;
    return true;
  }), [coverageAccountIds, filters, syncedGames]);
  const failedGameIds = useMemo(() => new Set(jobs.filter((job) => !job.supersededBy).flatMap((job) => job.items.filter((item) => item.status === "failed").map((item) => item.gameId))), [jobs]);
  const excludedGameIds = useMemo(() => new Set(jobs.flatMap((job) => (job.excludedItems ?? []).map((item) => item.gameId))), [jobs]);
  const historyJobGroups = useMemo(() => collapseHistoryJobs(jobs), [jobs]);
  const coverage = useMemo(() => {
    if (player?.kind !== "connected-account") {
      // Coverage describes the population the report describes, for every player
      // kind. A manual import has no sync backlog to count, so its eligible
      // population is exactly the games the current filters select — counting every
      // analyzed game of the player here used to claim "complete coverage of 5 of 5
      // games" while the report itself was describing none of them.
      const scoped = compatibleGames.filter((game) => studyGameMatchesFilters(game, filters));
      return {
        eligibleGames: scoped.length,
        analyzedGames: scoped.length,
        staleGames: 0,
        failedGames: 0,
        excludedGames: 0,
        approximateCacheBytes: cacheBytes,
      };
    }
    const coverageFor = (games: SyncedGame[]) => ({
      eligibleGames: games.filter((game) => !excludedGameIds.has(game.id)).length,
      analyzedGames: games.filter((game) => !excludedGameIds.has(game.id) && game.analysisAlgorithmVersion === OBJECTIVE_ALGORITHM_VERSION && game.analysisDepth === settings.reviewDepth).length,
      staleGames: games.filter((game) => !excludedGameIds.has(game.id) && game.analyzed && (game.analysisAlgorithmVersion !== OBJECTIVE_ALGORITHM_VERSION || game.analysisDepth !== settings.reviewDepth)).length,
      failedGames: games.filter((game) => !excludedGameIds.has(game.id) && !game.analyzed && failedGameIds.has(game.id)).length,
    });
    const totals = coverageFor(eligibleSynced);
    return {
      ...totals,
      excludedGames: eligibleSynced.filter((game) => excludedGameIds.has(game.id)).length,
      approximateCacheBytes: cacheBytes,
      providers: (["chesscom", "lichess"] as const).flatMap((provider) => {
        const games = eligibleSynced.filter((game) => game.external.provider === provider);
        if (games.length === 0) return [];
        return [{ provider, ...coverageFor(games) }];
      }),
    };
  }, [cacheBytes, compatibleGames, eligibleSynced, excludedGameIds, failedGameIds, filters, player, settings.reviewDepth]);
  const report = useMemo(() => player ? buildAdvancedStudyReportV2(compatibleGames, filters, coverage) : null, [compatibleGames, coverage, filters, player]);
  const queueIds = useMemo(() => new Set(queue.map(({ id }) => id)), [queue]);

  function setFilters(next: StudyReportFiltersV2) {
    const clean = { ...next };
    if (!next.dateFrom) delete clean.dateFrom;
    if (!next.dateTo) delete clean.dateTo;
    setFiltersState(clean);
  }

  async function startHistoryAnalysis(accountIds: string[] = selectedAccountIds) {
    if (jobWorking || accounts.length === 0) return;
    setJobWorking(true);
    setNotice(null);
    try {
      const scope: HistoryAnalysisScopeV1 = {
        providers: filters.providers,
        accountIds,
        timeClasses: filters.timeClasses,
        rated: filters.rated,
        freshness,
        ...(filters.dateFrom === undefined ? {} : { dateFrom: filters.dateFrom }),
        ...(filters.dateTo === undefined ? {} : { dateTo: filters.dateTo }),
      };
      const request = await createOrReuseHistoryAnalysisJob(scope, settings.reviewDepth, syncedGames);
      let job = request.job;
      if (job.status === "failed") job = await retryFailedHistoryAnalysisItems(job.id);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      if (job.items.length === 0) {
        setNotice("No games match this analysis scope.");
        return;
      }
      const completed = await runHistoryAnalysisJob(job.id, (updated) => setJobs((current) => [updated, ...current.filter((item) => item.id !== updated.id)]));
      setJobs((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
      await refreshSources();
      if (playerKey) setPlayer(await loadStudyPlayerLibrary(playerKey));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "History analysis failed.");
    } finally {
      setJobWorking(false);
    }
  }

  async function controlJob(job: HistoryAnalysisJobV1, action: "pause" | "resume" | "cancel" | "retry") {
    setNotice(null);
    try {
      let updated: HistoryAnalysisJobV1;
      if (action === "pause") updated = await pauseHistoryAnalysisJob(job.id);
      else if (action === "cancel") updated = await cancelHistoryAnalysisJob(job.id);
      else {
        updated = action === "retry" ? await retryFailedHistoryAnalysisItems(job.id) : job;
        void runHistoryAnalysisJob(updated.id, (progress) => setJobs((current) => [progress, ...current.filter((item) => item.id !== progress.id)]))
          .then(() => refreshSources())
          .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to resume history analysis."));
      }
      setJobs((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the history job.");
    }
  }

  async function removeHistoryRun(job: HistoryAnalysisJobV1) {
    if (!isHistoryAnalysisJobFinished(job)) return;
    if (!window.confirm("Remove this run from history? Synced games, reviews, Stockfish analyses and Training data will stay.")) return;
    try {
      await removeHistoryAnalysisJob(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      setNotice("Analysis run removed. Synced games and Training data were kept.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to remove this history run.");
    }
  }

  async function clearFinishedRuns() {
    if (!window.confirm("Clear finished analysis runs? This removes only run history; synced games, reviews, Stockfish analyses and Training data will stay.")) return;
    try {
      const removed = await clearFinishedHistoryAnalysisJobs();
      setJobs((current) => current.filter((job) => !isHistoryAnalysisJobFinished(job)));
      setNotice(removed === 0 ? "No finished analysis runs to clear." : `${removed} finished analysis run${removed === 1 ? "" : "s"} cleared. Training data was kept.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to clear finished history runs.");
    }
  }

  async function addWeakness(weakness: RecurringWeakness) {
    if (!player || queueWorking.current) return;
    const item = createTrainingQueueItem(player.key, weakness);
    queueWorking.current = true;
    setWorkingItem(item.id);
    try {
      await saveTrainingQueueItem(item, { ifAbsent: true });
      setQueue(await listTrainingQueue(player.key));
      setNotice(`${WEAKNESS_COPY[weakness.kind].title} added to the training queue.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save this task. Try again."); } finally {
      queueWorking.current = false;
      setWorkingItem(null);
    }
  }

  const loading = summaries === null;
  // The block owns the retry for its own failure state: the queue panel below can
  // only retry its local read, which would leave this block still claiming failure.
  function retryTrainingToday() {
    // The block is showing the failure state, so the flag has to clear with the
    // retry: otherwise it would keep claiming failure until the read settles.
    setSourcesFailed(false);
    setQueueState("loading");
    void refreshSources().catch((error) => {
      setSourcesFailed(true);
      setNotice(error instanceof Error ? error.message : "Unable to load training data.");
    });
  }

  const todayState: "loading" | "ready" | "failed" = summaries === null
    ? "loading"
    : sourcesFailed
      ? "failed"
      : queueState;
  const focusedTask = focusedTaskId === "" ? undefined : queue.find((item) => item.id === focusedTaskId);
  const todayTask = focusedTask && focusedTask.status !== "completed" ? focusedTask : todaysTrainingTask(queue);
  const analysisStatus = useMemo(() => liveAnalysisStatus(jobs), [jobs]);
  const scopeGameCount = report?.overview.summary.gameCount ?? (player?.games.length ?? eligibleSynced.length);
  // The report answers for a population, so the decision to show it follows the
  // player's own population and not the current filter: narrowing a filter to an
  // empty scope must leave the report standing and say the scope is empty, rather
  // than fold the whole page away under the visitor's hands. While that population
  // is still loading no report is claimed: falling back to the imported-game count
  // used to open the report and fold it away again a moment later.
  const availableGames = player === null ? 0 : player.games.length;
  const primaryRating = report?.ratings.slice().sort((left, right) => right.sampleSize - left.sampleSize)[0];
  const phaseEntries = report
    ? (["opening", "middlegame", "endgame"] as const).map((phase) => ({ phase, profile: report.phases[phase] }))
    : [];
  const observedPhases = phaseEntries.filter(({ profile }) => profile.moveCount > 0);
  const strongestPhase = observedPhases.slice().sort((left, right) => (right.profile.averageAccuracy ?? 0) - (left.profile.averageAccuracy ?? 0))[0];
  const needsWorkPhase = observedPhases.slice().sort((left, right) => right.profile.errorRate - left.profile.errorRate || (left.profile.averageAccuracy ?? 0) - (right.profile.averageAccuracy ?? 0))[0];
  const highlightCounts = report ? {
    brilliant: report.specialMoves.filter((item) => item.annotations.includes("brilliant")).length,
    critical: report.specialMoves.filter((item) => item.annotations.includes("critical")).length,
    comebacks: report.gameHighlights.filter((item) => item.kind === "comeback").length,
    saves: report.gameHighlights.filter((item) => item.kind === "save").length,
    conversions: report.gameHighlights.filter((item) => item.kind === "clean-conversion").length,
  } : null;
  const brilliantMoves = report?.specialMoves.filter((item) => item.annotations.includes("brilliant")) ?? [];
  const criticalMoves = report?.specialMoves.filter((item) => item.annotations.includes("critical")) ?? [];
  const showStudyReport = Boolean(todayTask) || availableGames >= 5;
  // A population this small cannot carry a statistics report, so the report stays
  // folded. An analysis run is not statistics: a paused or failed run must keep
  // its own controls wherever its status is reported, or the visitor is told work
  // is waiting with no way to continue it.
  const showRunHistory = historyJobGroups.length > 0;
  // Imported games that still need objective analysis. A connected account is a
  // population before it is a report, so this state has to be able to start the
  // work that would produce one — starting with the account the visitor selected.
  const unanalyzedEligibleCount = eligibleSynced.filter((game) => !excludedGameIds.has(game.id) && !game.analyzed).length;
  const canAnalyzeHistory = accounts.length > 0 && unanalyzedEligibleCount > 0 && !hasActiveHistoryJob;
  return <main className="page-scroll study-page">
    <AppHeader />
    <section className="utility-heading study-heading">
      <h1>Training</h1>
      {summaries && summaries.length > 0 && <label className="study-player-select"><span>Player</span><select value={playerKey} onChange={(event) => { playerSelectionTouched.current = true; setPlayerKey(event.target.value); }}>{summaries.map((summary) => <option key={summary.key} value={summary.key}>{summary.name} · {summary.gameCount} games{summary.provider ? ` · ${summary.provider === "chesscom" ? "Chess.com" : "Lichess"}` : " · manual"}</option>)}</select></label>}
    </section>
    <TrainingToday
      state={todayState}
      task={todayTask}
      plan={report?.trainingPlan ?? []}
      topWeakness={report?.weaknesses[0]}
      focusedFromLink={focusedTaskId !== "" && todayTask?.id === focusedTaskId}
      onAddFocus={(weakness) => void addWeakness(weakness)}
      onRetry={retryTrainingToday}
      disabled={!player || workingItem !== null}
      {...(player?.games.at(-1) ? { lastReviewHref: `/review/${player.games.at(-1)!.gameId}` } : {})}
    />
    <TrainingQueuePanel />
    {analysisStatus && <p className="study-analysis-status" role="status">{analysisStatus}</p>}
    {notice && <p className="study-notice" role="status">{notice}</p>}
    {loading ? <section className="study-empty">Loading…</section> : summaries.length === 0 ? <>
      {accounts.length > 0 && <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} gameCount={scopeGameCount} open={scopeOpen} onToggle={setScopeOpen} />}
      <section className="study-empty"><strong>{jobs.some((job) => job.items.some((item) => item.status === "cached" || item.status === "completed")) ? "Analysis is arriving" : "No current analyses"}</strong><span>{accounts.length > 0 ? `${eligibleSynced.length} synced games match this scope.` : "Sync games or complete an objective review."}</span>{accounts.length === 0 ? <Link className="primary-link" href="/history">Open History</Link> : <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={startHistoryAnalysis} /></div>}{historyJobGroups.length > 0 && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}</section>
    </> : !showStudyReport ? (showRunHistory || canAnalyzeHistory ? <section className="study-runs-only">
      {canAnalyzeHistory && <>
        <div className="history-analysis-heading"><span>Analyse imported games</span></div>
        <p className="quiet-empty">{unanalyzedEligibleCount} of {eligibleSynced.length} imported games in this scope have no objective analysis yet.</p>
        <div className="empty-history-actions"><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={() => startHistoryAnalysis(player?.accountId ? [player.accountId] : selectedAccountIds)} /></div>
      </>}
      {showRunHistory && <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />}
    </section> : null) : <>
      <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} gameCount={scopeGameCount} open={scopeOpen} onToggle={setScopeOpen} />
      <nav className="study-nav" aria-label="Training views">
        {NAV_GROUPS.map((group) => <div key={group.id} className="study-nav-group">{group.label ? <p className="study-nav-label">{group.label}</p> : <p className="study-nav-label study-nav-label-spacer" aria-hidden="true"> </p>}<div className="study-nav-tabs">{group.tabs.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => selectView(tab.id)}>{tab.label}</button>)}</div></div>)}
      </nav>
      {!player || !report ? <section className="study-empty">Loading selected player…</section> : <div className="study-sections">
        {activeTab === "overview" && <section className="study-overview" id="player-profile">
          <article className="study-paper study-profile">
            <header className="study-profile-heading">
              <div><span className="eyebrow">Player profile</span><h2>{player.name}</h2><p>{primaryRating ? `${primaryRating.provider === "chesscom" ? "Chess.com" : "Lichess"} · ${primaryRating.timeClass}` : "Objective analysis profile"}</p></div>
              <button type="button" className="text-button" onClick={() => selectView("ratings")}>View rating & form →</button>
            </header>
            <dl className="study-profile-facts">
              <div><dt>Current observed rating</dt><dd>{primaryRating?.currentRating ?? "—"}</dd><small>{primaryRating?.recentRange ? `Recent range ${primaryRating.recentRange.low}–${primaryRating.recentRange.high}` : "No platform rating in this scope"}</small></div>
              <div><dt>Form</dt><dd>{report.overview.summary.accuracyChange === undefined ? "—" : `${report.overview.summary.accuracyChange >= 0 ? "+" : ""}${report.overview.summary.accuracyChange.toFixed(1)}`}</dd><small>Accuracy trend · {formatted(report.overview.summary.averageAccuracy)} average per game</small></div>
              <div><dt>Next meaningful target</dt><dd>{primaryRating?.stabilizeTarget ?? primaryRating?.nextTarget ?? "—"}</dd><small>{primaryRating?.stabilizeTarget && primaryRating.nextTarget ? `Stabilize ${primaryRating.stabilizeTarget} · then ${primaryRating.nextTarget}` : "Build a larger rated sample"}</small></div>
              <div><dt>Analysis coverage</dt><dd>{report.coverage.state === "empty" ? "—" : `${report.coverage.analyzedGames}/${report.coverage.eligibleGames}`}</dd><small>{report.coverage.state === "empty" ? "No games in this scope" : `${formatted(report.coverage.coverageRate, "%")} current · ${primaryRating?.confidence ?? "low"} confidence`}</small></div>
            </dl>
            {primaryRating?.performanceRating !== undefined && <p className="study-profile-note">Estimated recent performance {primaryRating.performanceRating} from {primaryRating.performanceSampleSize} games with both opponent rating and result.</p>}
          </article>
          {observedPhases.length > 0 && <div className="study-phase-row">
            {observedPhases.map(({ phase, profile }) => {
              const strongest = observedPhases.length > 1 && strongestPhase?.phase === phase;
              const focus = observedPhases.length > 1 && needsWorkPhase?.phase === phase && !strongest;
              const wash = phase === "opening" ? "mist" : phase === "middlegame" ? "pink" : "sage";
              const conversion = profile.advantageOpportunities > 0 ? Math.round((100 * profile.advantagePreserved) / profile.advantageOpportunities) : undefined;
              const detail = phase === "endgame" && conversion !== undefined
                ? `${conversion}% advantages preserved`
                : phase === "middlegame"
                  ? `${formatted(profile.errorRate, "%")} decision errors`
                  : `${formatted(profile.errorRate, "%")} errors`;
              return <article key={phase} className="study-wash" data-wash={wash}><span className="eyebrow">{phase}</span><strong>{formatted(profile.averageAccuracy)}</strong><small>{strongest ? "Strongest phase" : focus ? "Primary improvement area" : `${profile.moveCount} moves`} · average move Accuracy</small><p>{detail}</p></article>;
            })}
          </div>}
          <article className="study-paper study-focus">
            <header><span className="eyebrow">Focus now</span><button type="button" className="text-button" onClick={() => selectView("plan")}>Open plan →</button></header>
            {report.trainingPlan.length > 0 ? <ol>{report.trainingPlan.slice(0, 3).map((item) => <li key={item.weaknessKind}><strong>{item.title}</strong><small>{item.rationale}</small>{item.evidence[0] && <Link href={`/review/${item.evidence[0].gameId}/moves?ply=${item.evidence[0].ply}`}>{item.evidence[0].san} · ply {item.evidence[0].ply}</Link>}</li>)}</ol> : <p>Keep collecting analyzed games to establish a reliable training focus.</p>}
          </article>
          <article className="study-highlights-summary">
            <header><span className="eyebrow">Highlights</span><button type="button" className="text-button" onClick={() => selectView("highlights")}>View Highlights →</button></header>
            <p><span><strong>{highlightCounts?.brilliant ?? 0}</strong> Brilliant</span><span><strong>{highlightCounts?.critical ?? 0}</strong> Critical</span><span><strong>{highlightCounts?.comebacks ?? 0}</strong> Comebacks</span><span><strong>{highlightCounts?.conversions ?? 0}</strong> Clean conversions</span></p>
          </article>
          <div className="study-form-summary">
            <div className="study-form-heading">
              <p className="study-ink-stats">
                <span><strong>{report.overview.summary.gameCount}</strong> Games</span>
                <span><strong>{formatted(report.overview.summary.averageAccuracy)}</strong> Accuracy per game</span>
                <span><strong>{report.coverage.state === "empty" ? "—" : formatted(report.coverage.coverageRate, "%")}</strong> Coverage</span>
              </p>
              <p className="study-trend-legend">Result under each bar: <span data-result="win">W win</span><span data-result="draw">D draw</span><span data-result="loss">L loss</span></p>
            </div>
            <ol className="study-trend-chart" aria-label="Accuracy by game, with win, draw, or loss under each bar">{report.overview.games.slice(-18).map((point) => <li key={point.gameId} data-result={point.result}><span className="trend-track"><i style={{ height: `${Math.max(2, point.accuracy ?? 0)}%` }} /></span><Link href={`/review/${point.gameId}`} aria-label={`${point.title}, ${point.result === "win" ? "win" : point.result === "draw" ? "draw" : point.result === "loss" ? "loss" : "unknown result"}, Accuracy ${formatted(point.accuracy)}`}>{point.result === "win" ? "W" : point.result === "draw" ? "D" : point.result === "loss" ? "L" : ""}</Link></li>)}</ol>
          </div>
        </section>}

        {activeTab === "ratings" && <section id="rating-form"><header className="study-section-heading"><h2>Rating & Form</h2><small>Platform rating and time controls stay separate. Performance is an estimate, never derived from Accuracy.</small></header>{report.ratings.length === 0 ? <p className="study-section-empty">No rating evidence in this population.</p> : report.ratings.map((band) => <article key={band.key} className="study-paper study-rating-band"><span className="eyebrow">{band.provider === "chesscom" ? "Chess.com" : "Lichess"} · {band.timeClass}</span><strong className="study-rating-primary">{band.currentRating ?? "—"}</strong><p>{band.recentRange ? `Recent range ${band.recentRange.low}–${band.recentRange.high}` : "No recent range"} · {band.sampleSize} games · {band.confidence} confidence</p><dl className="study-profile-facts"><div><dt>Estimated recent performance</dt><dd>{band.performanceRating ?? "—"}</dd><small>Matched sample {band.performanceSampleSize}</small></div><div><dt>Score</dt><dd>{formatted(report.overview.scoreRate, "%")}</dd><small>Accuracy {formatted(report.overview.summary.averageAccuracy)}</small></div><div><dt>Next meaningful target</dt><dd>{band.stabilizeTarget ?? band.nextTarget ?? "—"}</dd><small>{band.stabilizeTarget && band.nextTarget ? `Stabilize ${band.stabilizeTarget} · then ${band.nextTarget}` : "Need a larger rated sample"}</small></div></dl></article>)}</section>}

        {activeTab === "openings" && <section id="openings"><header className="study-section-heading"><h2>Openings</h2><small>What you play, and how well you play it.</small></header>{report.openings.length === 0 ? <p className="study-section-empty">No recognized openings.</p> : <><div className="repertoire-list">{report.openings.slice(0, listLimit).map((opening) => <article key={opening.key}><span className={`repertoire-color ${opening.color}`}>{opening.color === "white" ? "W" : "B"}</span><div><small>{opening.eco} · {formatted(opening.share, "%")}</small><strong>{opening.name}</strong>{opening.variation && <span>{opening.variation}</span>}<span>{opening.gameCount} games · {opening.wins}W {opening.draws}D {opening.losses}L</span></div><dl><div><dt>Accuracy</dt><dd>{formatted(opening.averageAccuracy)}</dd></div><div><dt>Recent</dt><dd>{formatted(opening.recentAccuracy)}</dd></div><div><dt>Win% loss</dt><dd>{formatted(opening.averageWinPercentLoss)}</dd></div><div><dt>Errors</dt><dd>{formatted(opening.errorRate, "%")}</dd></div></dl><div className="training-sources">{opening.problemPositions.slice(0, 3).map((item) => <Link key={`${item.gameId}:${item.ply}`} href={`/review/${item.gameId}/moves?ply=${item.ply}`}>{item.san} · ply {item.ply}</Link>)}</div></article>)}</div>{report.openings.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>Show more openings</button>}</>}</section>}

        {(activeTab === "middlegame" || activeTab === "endgame") && (() => {
          const phase = report.phases[activeTab];
          const endgame = activeTab === "endgame";
          const evidence = report.mistakes.filter((item) => item.phase === activeTab).slice(0, 8);
          return <section id={activeTab}><header className="study-section-heading"><h2>{endgame ? "Endgame" : "Middlegame"}</h2><small>{endgame ? "How well you convert and defend late positions. No tablebase claims." : "How good your decisions are after the opening."}</small></header>
            <div className="study-metric-groups">
              <section className="study-wash" data-wash="mist"><h3>Decision quality</h3><dl><div><dt>Moves</dt><dd>{phase.moveCount}</dd></div><div><dt>Error rate</dt><dd>{formatted(phase.errorRate, "%")}</dd></div><div><dt>Average Win% loss</dt><dd>{formatted(phase.averageWinPercentLoss)}</dd></div>{!endgame && <div><dt>Decision errors</dt><dd>{phase.errorCount}</dd></div>}</dl></section>
              <section className="study-wash" data-wash="cream"><h3>Recent form</h3><dl><div><dt>Average move Accuracy</dt><dd>{formatted(phase.averageAccuracy)}</dd></div><div><dt>Recent average move Accuracy</dt><dd>{formatted(phase.recentAccuracy)}</dd></div></dl><small>{`Arithmetic mean of ${phase.accuracyMetric.sampleMoves} moves from ${phase.accuracyMetric.sampleGames} games. Review shows the canonical single-game phase Accuracy, which is a different measure.`}</small></section>
              <section className="study-wash" data-wash="sage"><h3>{endgame ? "Conversion" : "Advantages"}</h3><dl><div><dt>Advantages preserved</dt><dd>{phase.advantagePreserved}/{phase.advantageOpportunities}</dd></div>{endgame && <div><dt>Defensive holds</dt><dd>{phase.defensiveHolds}/{phase.defensivePositions}</dd></div>}</dl></section>
              <section className="study-wash" data-wash="pink"><h3>{endgame ? "Missed wins / mates" : "Opportunities"}</h3><dl><div><dt>Missed opportunities</dt><dd>{phase.missedOpportunities}</dd></div></dl>{evidence.length > 0 && <ul className="study-evidence-list">{evidence.map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={20} /><span><strong title={item.san}>{item.san}</strong><small>−{item.winPercentLoss.toFixed(1)} Win%</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Review →</Link></li>)}</ul>}</section>
            </div>
          </section>;
        })()}

        {activeTab === "mistakes" && <section id="mistakes"><header className="study-section-heading"><h2>Mistakes</h2><small>Which decisions deserve review.</small></header>{report.mistakes.length === 0 ? <p className="study-section-empty">No errors in this population.</p> : <><ul className="study-evidence-list">{report.mistakes.slice(0, listLimit).map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={22} /><span><strong title={item.san}>{item.san} · {QUALITY_META[item.classification].label}</strong><small>{item.phase} · −{item.winPercentLoss.toFixed(1)} Win% · {new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Review →</Link></li>)}</ul>{report.mistakes.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>Show more mistakes</button>}</>}</section>}

        {activeTab === "highlights" && <section id="highlights"><header className="study-section-heading"><h2>Highlights</h2><small>Notable chess moments, grouped by kind.</small></header>{report.specialMoves.length + report.gameHighlights.length === 0 ? <p className="study-section-empty">No verified highlights in this population.</p> : <div className="study-highlight-groups">
          <section data-kind="brilliant"><h3>Brilliant <small>{brilliantMoves.length}</small></h3>{brilliantMoves.length === 0 ? <p className="study-section-empty">None in this population.</p> : <ul className="study-highlight-cards">{brilliantMoves.slice(0, 6).map((item) => <li key={`${item.gameId}:${item.ply}`} className="study-highlight-card" data-kind="brilliant"><QualityIcon classification="brilliant" size={22} /><span><strong>{item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Open in Review →</Link></li>)}</ul>}</section>
          <section data-kind="critical"><h3>Critical <small>{criticalMoves.length}</small></h3>{criticalMoves.length === 0 ? <p className="study-section-empty">None in this population.</p> : <ul className="study-highlight-cards">{criticalMoves.slice(0, listLimit).map((item) => <li key={`${item.gameId}:${item.ply}`} className="study-highlight-card" data-kind="critical"><QualityIcon classification="great" size={22} /><span><strong>{item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Open in Review →</Link></li>)}</ul>}{criticalMoves.length > listLimit && <button type="button" className="text-button" onClick={() => setListLimit((current) => current + 12)}>View more critical moments</button>}</section>
          {(["comeback", "save", "clean-conversion", "best-game"] as const).map((kind) => {
            const items = report.gameHighlights.filter((item) => item.kind === kind);
            if (items.length === 0) return null;
            return <section key={kind} data-kind={kind}><h3>{kind.replaceAll("-", " ")} <small>{items.length}</small></h3><ul className="study-highlight-cards">{items.slice(0, 6).map((item) => <li key={`${item.kind}:${item.gameId}`} className="study-highlight-card" data-kind={kind}><span><strong>{item.title}</strong><small>{item.accuracy === undefined ? "" : `${item.accuracy.toFixed(1)} Accuracy`}</small></span><Link href={item.referencePly ? `/review/${item.gameId}/moves?ply=${item.referencePly}` : `/review/${item.gameId}`}>Open →</Link></li>)}</ul></section>;
          })}
        </div>}</section>}

        {activeTab === "plan" && <section id="training-plan"><header className="study-section-heading"><h2>Plan</h2><small>Ranked from measurable source positions.</small></header>{report.trainingPlan.length === 0 ? <p className="study-section-empty">No recurring weakness has enough evidence yet.</p> : <div className="weakness-grid">{report.weaknesses.map((weakness, index) => { const itemId = trainingQueueItemId(player.key, weakness.kind); return <article key={weakness.kind}><div className="weakness-head"><span className="weakness-priority">{index + 1}</span><div><strong>{WEAKNESS_COPY[weakness.kind].title}</strong><p>{WEAKNESS_COPY[weakness.kind].description}</p></div></div><div className="weakness-metrics"><span>{formatted(weakness.frequency, "%")} of games</span><span>{weakness.confidence} confidence</span><span>{weakness.trend}</span></div><ul>{weakness.evidence.slice(0, 5).map((item) => <li key={`${item.gameId}:${item.ply}`}><span><strong title={item.san}>{item.san}</strong><small>{item.phase} · −{item.winPercentLoss.toFixed(1)} Win%</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Review →</Link></li>)}</ul><button type="button" className="text-button" disabled={queueIds.has(itemId) || workingItem !== null} onClick={() => void addWeakness(weakness)}>{queueIds.has(itemId) ? "In queue" : "Add to queue"}</button></article>; })}</div>}

        </section>}

        {activeTab === "coverage" && <section id="coverage"><header className="study-section-heading"><h2>Coverage</h2><small>{report.algorithmVersion} · {report.objectiveAlgorithmVersion}</small></header><div className="study-metrics"><article><span>Eligible</span><strong>{report.coverage.eligibleGames}</strong></article><article><span>Current</span><strong>{report.coverage.analyzedGames}</strong><small>{formatted(report.coverage.coverageRate, "%")}</small></article><article><span>Stale</span><strong>{report.coverage.staleGames}</strong></article><article><span>Failed</span><strong>{report.coverage.failedGames}</strong></article></div>{report.coverage.providers && report.coverage.providers.length > 0 && <div className="coverage-provider-grid">{report.coverage.providers.map((item) => <article key={item.provider}><strong>{item.provider === "chesscom" ? "Chess.com" : "Lichess"}</strong><span>{item.analyzedGames}/{item.eligibleGames} current</span><small>{item.staleGames} stale · {item.failedGames} failed</small></article>)}</div>}<p className="study-section-empty">{report.coverage.state === "empty" ? "No imported games match this scope yet, so there is nothing to cover." : report.coverage.partial ? "This report is partial. Conclusions use only current compatible analyses." : `This filtered population has complete current analysis coverage: ${report.coverage.analyzedGames} of ${report.coverage.eligibleGames} games.`}{report.coverage.excludedGames > 0 ? ` ${report.coverage.excludedGames} provider game${report.coverage.excludedGames === 1 ? "" : "s"} with invalid PGN ${report.coverage.excludedGames === 1 ? "is" : "are"} excluded and do not keep this range incomplete.` : ""}{filters.openingKeys.length > 0 ? " Opening is known only for current analyses, so coverage remains based on the broader synced scope." : ""} Local objective cache: {(cacheBytes / 1024 / 1024).toFixed(1)} MB.</p>
          {accounts.length > 0 && <div className="history-analysis-controls"><label><span>Account scope</span><select value={jobAccountScope} onChange={(event) => setJobAccountScope(event.target.value as "selected" | "all")}><option value="all">All connected accounts</option><option value="selected" disabled={!player.accountId}>Selected account</option></select></label><HistoryAnalysisControls freshness={freshness} jobWorking={jobWorking} onFreshness={setFreshness} onStart={startHistoryAnalysis} /></div>}
          <HistoryJobsPanel groups={historyJobGroups} games={syncedGames} onControl={controlJob} onRemove={removeHistoryRun} onClear={clearFinishedRuns} />
        </section>}
      </div>}
    </>}
  </main>;
}
