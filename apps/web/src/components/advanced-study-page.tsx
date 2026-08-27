"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAdvancedStudyReportV2,
  listStudyOpeningFilterOptionsV2,
  OBJECTIVE_ALGORITHM_VERSION,
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
  TrainingQueueItemV1,
  TrainingQueueItemV2,
  TrainingQueueStatus,
} from "@chess-review/shared";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";
import { AppHeader } from "./app-header";
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
  createOrReuseHistoryAnalysisJob,
  HISTORY_ANALYSIS_CONCURRENCY,
  pauseHistoryAnalysisJob,
  recoverInterruptedHistoryJobs,
  retryFailedHistoryAnalysisItems,
  runHistoryAnalysisJob,
} from "../lib/history-analysis-jobs";
import { listPlatformAccounts, listSyncedGames } from "../lib/platform-library";
import {
  createTrainingQueueItem,
  listTrainingQueue,
  removeTrainingQueueItem,
  saveTrainingQueueItem,
  trainingQueueItemId,
  transitionTrainingQueueItem,
} from "../lib/training-queue";

type StudyTab = "overview" | "ratings" | "openings" | "middlegame" | "endgame" | "mistakes" | "highlights" | "plan" | "coverage";
type QueueItem = TrainingQueueItemV1 | TrainingQueueItemV2;

const TABS: Array<{ id: StudyTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "ratings", label: "Rating & Form" },
  { id: "openings", label: "Openings" },
  { id: "middlegame", label: "Middlegame" },
  { id: "endgame", label: "Endgame" },
  { id: "mistakes", label: "Mistakes" },
  { id: "highlights", label: "Highlights" },
  { id: "plan", label: "Plan" },
  { id: "coverage", label: "Coverage" },
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

function queueActionLabel(status: TrainingQueueStatus): string {
  if (status === "queued") return "Start";
  if (status === "in-progress") return "Complete";
  return "Reopen";
}

function nextQueueStatus(status: TrainingQueueStatus): TrainingQueueStatus {
  if (status === "queued") return "in-progress";
  if (status === "in-progress") return "completed";
  return "queued";
}

function detailedJobCounts(job: HistoryAnalysisJobV1) {
  const cached = job.items.filter((item) => item.status === "cached").length;
  const completed = job.items.filter((item) => item.status === "completed").length;
  const failed = job.items.filter((item) => item.status === "failed").length;
  const pending = job.items.filter((item) => item.status === "queued" || item.status === "running").length;
  return { cached, completed, failed, pending, done: cached + completed, total: job.items.length };
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

function HistoryJobCard({
  job,
  games,
  duplicateCount,
  compact = false,
  onControl,
}: {
  job: HistoryAnalysisJobV1;
  games: readonly SyncedGame[];
  duplicateCount: number;
  compact?: boolean;
  onControl: (job: HistoryAnalysisJobV1, action: HistoryJobAction) => void | Promise<void>;
}) {
  const counts = detailedJobCounts(job);
  const failedItems = job.items.filter((item) => item.status === "failed");
  const successfulItems = job.items.filter((item) => item.status === "cached" || item.status === "completed");
  const statusLabel = job.status === "failed" && counts.done > 0 ? "partial" : job.status;
  return <article className={`history-job-card ${compact ? "compact" : ""} ${job.status}`}>
    <div className="history-job-heading">
      <div>
        <strong>{statusLabel}</strong>
        <small>{counts.done}/{counts.total} complete · {counts.completed} analyzed · {counts.cached} cache reused{counts.failed > 0 ? ` · ${counts.failed} failed` : ""}{counts.pending > 0 ? ` · ${counts.pending} pending` : ""} · depth {job.depth}</small>
        {(job.excludedItems?.length ?? 0) > 0 && <small>{job.excludedItems!.length} game{job.excludedItems!.length === 1 ? "" : "s"} skipped: provider PGN is invalid and cannot be analyzed.</small>}
        {duplicateCount > 0 && <small>{duplicateCount} duplicate job{duplicateCount === 1 ? "" : "s"} collapsed</small>}
      </div>
      <progress max={Math.max(1, counts.total)} value={counts.done + counts.failed} aria-label={`${counts.done} of ${counts.total} games analyzed`} />
    </div>
    {counts.done > 0 && <p className="history-job-success">✓ {counts.done} successful analysis{counts.done === 1 ? "" : "es"} already added to Training{counts.pending > 0 ? "; more results will appear as they finish" : "."}</p>}
    {job.error && <p className={counts.done > 0 ? "history-job-partial" : "history-job-error"}>{job.error}</p>}
    {failedItems.length > 0 && <details className="history-job-details">
      <summary>Why {failedItems.length} game{failedItems.length === 1 ? "" : "s"} failed</summary>
      <ul>{failedItems.map((item) => <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games)}</strong><small>{item.error ?? "No reason was recorded. Retry this item to capture the engine/provider error."}</small></span></li>)}</ul>
    </details>}
    {(job.excludedItems?.length ?? 0) > 0 && <details className="history-job-details">
      <summary>Why {job.excludedItems!.length} game{job.excludedItems!.length === 1 ? "" : "s"} cannot be analyzed</summary>
      <ul>{job.excludedItems!.map((item) => <li key={item.gameId}><span><strong>{gameLabel(item.gameId, games)}</strong><small>Invalid PGN from the provider — {item.reason}. This game is outside chess rules parsing and is not counted as an analysis failure.</small></span></li>)}</ul>
    </details>}
    {successfulItems.length > 0 && <details className="history-job-details" open={counts.done > 0 && !compact}>
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
    </div>
  </article>;
}

function ScopeFilters({
  filters,
  setFilters,
  timeClasses,
  openingOptions,
}: {
  filters: StudyReportFiltersV2;
  setFilters: (filters: StudyReportFiltersV2) => void;
  timeClasses: string[];
  openingOptions: Array<{ key: string; label: string }>;
}) {
  return <section className="study-filters" aria-label="Study population filters">
    <label><span>Source</span><select value={filters.providers[0] ?? "all"} onChange={(event) => setFilters({ ...filters, providers: event.target.value === "all" ? [] : [event.target.value as "chesscom" | "lichess"] })}><option value="all">All sources</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label>
    <label><span>Time control</span><select value={filters.timeClasses[0] ?? "all"} onChange={(event) => setFilters({ ...filters, timeClasses: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">All time controls</option>{timeClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>Rated</span><select value={filters.rated} onChange={(event) => setFilters({ ...filters, rated: event.target.value as StudyReportFiltersV2["rated"] })}><option value="all">All games</option><option value="rated">Rated</option><option value="casual">Casual</option></select></label>
    <label><span>Color</span><select value={filters.playerColors[0] ?? "all"} onChange={(event) => setFilters({ ...filters, playerColors: event.target.value === "all" ? [] : [event.target.value as "white" | "black"] })}><option value="all">Both colors</option><option value="white">White</option><option value="black">Black</option></select></label>
    <label><span>Opening</span><select value={filters.openingKeys[0] ?? "all"} disabled={openingOptions.length === 0} onChange={(event) => setFilters({ ...filters, openingKeys: event.target.value === "all" ? [] : [event.target.value] })}><option value="all">All openings</option>{openingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    <label><span>Minimum sample</span><select value={filters.minimumSampleSize} onChange={(event) => setFilters({ ...filters, minimumSampleSize: Number(event.target.value) })}>{[1, 2, 3, 5, 10].map((value) => <option key={value} value={value}>{value} game{value === 1 ? "" : "s"}</option>)}</select></label>
    <label><span>From</span><input type="date" value={filters.dateFrom?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateFrom = `${event.target.value}T00:00:00.000Z`; else delete next.dateFrom; setFilters(next); }} /></label>
    <label><span>To</span><input type="date" value={filters.dateTo?.slice(0, 10) ?? ""} onChange={(event) => { const next = { ...filters }; if (event.target.value) next.dateTo = `${event.target.value}T23:59:59.999Z`; else delete next.dateTo; setFilters(next); }} /></label>
  </section>;
}

export function AdvancedStudyPage() {
  const settings = useMemo(() => loadAppSettings(), []);
  const [summaries, setSummaries] = useState<StudyPlayerSummary[] | null>(null);
  const [playerKey, setPlayerKey] = useState("");
  const [player, setPlayer] = useState<StudyPlayerLibrary | null>(null);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [syncedGames, setSyncedGames] = useState<SyncedGame[]>([]);
  const [jobs, setJobs] = useState<HistoryAnalysisJobV1[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filters, setFiltersState] = useState<StudyReportFiltersV2>(DEFAULT_FILTERS);
  const [freshness, setFreshness] = useState<HistoryAnalysisScopeV1["freshness"]>("all");
  const [jobAccountScope, setJobAccountScope] = useState<"selected" | "all">("all");
  const [activeTab, setActiveTab] = useState<StudyTab>("overview");
  const [cacheBytes, setCacheBytes] = useState(0);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [jobWorking, setJobWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [playerRevision, setPlayerRevision] = useState(0);
  const queueWorking = useRef(false);
  // Keep an explicit user choice stable, but allow a connected account to
  // replace a temporary manual default when background analysis finishes.
  const playerSelectionTouched = useRef(false);
  const jobProgressSignature = useRef("");

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
      return nextSummaries.find(({ kind }) => kind === "connected-account")?.key ?? nextSummaries[0]?.key ?? "";
    });
    const nextProgressSignature = nextJobs.map((job) => `${job.id}:${job.status}:${job.items.map((item) => `${item.gameId}:${item.status}:${item.analysisId ?? ""}`).join(",")}`).join("|");
    if (jobProgressSignature.current !== nextProgressSignature) {
      jobProgressSignature.current = nextProgressSignature;
      setPlayerRevision((current) => current + 1);
    }
  }, []);

  useEffect(() => {
    void refreshSources().catch((error) => {
      setSummaries([]);
      setNotice(error instanceof Error ? error.message : "Unable to load training data.");
    });
  }, [refreshSources]);

  useEffect(() => {
    setFiltersState((current) => current.openingKeys.length === 0 ? current : { ...current, openingKeys: [] });
  }, [playerKey]);

  useEffect(() => {
    let active = true;
    if (!playerKey) {
      setPlayer(null);
      setQueue([]);
      return;
    }
    void Promise.all([loadStudyPlayerLibrary(playerKey), listTrainingQueue(playerKey)]).then(([library, items]) => {
      if (!active) return;
      setPlayer(library);
      setQueue(items);
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "Unable to load this player.");
    });
    return () => { active = false; };
  }, [playerKey, playerRevision]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "running" || job.status === "queued")) return;
    const timer = window.setInterval(() => {
      void refreshSources().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to refresh analysis progress."));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [jobs, refreshSources]);

  // A final item can finish immediately before a partial job is persisted as
  // failed. Refresh once on that terminal transition so the successful cache
  // projections are visible even though polling no longer needs to continue.
  const terminalSuccessSignature = useMemo(() => jobs
    .filter((job) => (job.status === "failed" || job.status === "completed")
      && job.items.some((item) => item.status === "cached" || item.status === "completed"))
    .map((job) => `${job.id}:${job.updatedAt}`)
    .sort()
    .join("|"), [jobs]);

  useEffect(() => {
    if (!terminalSuccessSignature) return;
    void refreshSources().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to refresh completed analyses."));
  }, [refreshSources, terminalSuccessSignature]);

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
  const failedGameIds = useMemo(() => new Set(jobs.flatMap((job) => job.items.filter((item) => item.status === "failed").map((item) => item.gameId))), [jobs]);
  const historyJobGroups = useMemo(() => collapseHistoryJobs(jobs).slice(0, 5), [jobs]);
  const coverage = useMemo(() => player?.kind === "connected-account" ? {
    eligibleGames: eligibleSynced.length,
    analyzedGames: eligibleSynced.filter((game) => game.analysisAlgorithmVersion === OBJECTIVE_ALGORITHM_VERSION && game.analysisDepth === settings.reviewDepth).length,
    staleGames: eligibleSynced.filter((game) => game.analyzed && (game.analysisAlgorithmVersion !== OBJECTIVE_ALGORITHM_VERSION || game.analysisDepth !== settings.reviewDepth)).length,
    failedGames: eligibleSynced.filter((game) => !game.analyzed && failedGameIds.has(game.id)).length,
    excludedGames: Math.max(0, syncedGames.filter((game) => game.external.accountId === player.accountId).length - eligibleSynced.length),
    approximateCacheBytes: cacheBytes,
    providers: (["chesscom", "lichess"] as const).flatMap((provider) => {
      const games = eligibleSynced.filter((game) => game.external.provider === provider);
      if (games.length === 0) return [];
      return [{
        provider,
        eligibleGames: games.length,
        analyzedGames: games.filter((game) => game.analysisAlgorithmVersion === OBJECTIVE_ALGORITHM_VERSION && game.analysisDepth === settings.reviewDepth).length,
        staleGames: games.filter((game) => game.analyzed && (game.analysisAlgorithmVersion !== OBJECTIVE_ALGORITHM_VERSION || game.analysisDepth !== settings.reviewDepth)).length,
        failedGames: games.filter((game) => !game.analyzed && failedGameIds.has(game.id)).length,
      }];
    }),
  } : {
    eligibleGames: compatibleGames.length,
    analyzedGames: compatibleGames.length,
    staleGames: 0,
    failedGames: 0,
    excludedGames: 0,
    approximateCacheBytes: cacheBytes,
  }, [cacheBytes, compatibleGames.length, eligibleSynced, failedGameIds, player, settings.reviewDepth, syncedGames]);
  const report = useMemo(() => player ? buildAdvancedStudyReportV2(compatibleGames, filters, coverage) : null, [compatibleGames, coverage, filters, player]);
  const queueIds = useMemo(() => new Set(queue.map(({ id }) => id)), [queue]);

  function setFilters(next: StudyReportFiltersV2) {
    const clean = { ...next };
    if (!next.dateFrom) delete clean.dateFrom;
    if (!next.dateTo) delete clean.dateTo;
    setFiltersState(clean);
  }

  async function startHistoryAnalysis() {
    if (jobWorking || accounts.length === 0) return;
    setJobWorking(true);
    setNotice(null);
    try {
      const scope: HistoryAnalysisScopeV1 = {
        providers: filters.providers,
        accountIds: selectedAccountIds,
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

  async function addWeakness(weakness: RecurringWeakness) {
    if (!player || queueWorking.current) return;
    const item = createTrainingQueueItem(player.key, weakness);
    queueWorking.current = true;
    setWorkingItem(item.id);
    try {
      await saveTrainingQueueItem(item);
      setQueue(await listTrainingQueue(player.key));
      setNotice(`${WEAKNESS_COPY[weakness.kind].title} added to the training queue.`);
    } finally {
      queueWorking.current = false;
      setWorkingItem(null);
    }
  }

  async function transition(item: QueueItem) {
    if (!player || queueWorking.current) return;
    queueWorking.current = true;
    setWorkingItem(item.id);
    try {
      await saveTrainingQueueItem(transitionTrainingQueueItem(item, nextQueueStatus(item.status)));
      setQueue(await listTrainingQueue(player.key));
    } finally {
      queueWorking.current = false;
      setWorkingItem(null);
    }
  }

  async function remove(item: QueueItem) {
    if (!player || queueWorking.current) return;
    queueWorking.current = true;
    setWorkingItem(item.id);
    try {
      await removeTrainingQueueItem(item.id);
      setQueue(await listTrainingQueue(player.key));
    } finally {
      queueWorking.current = false;
      setWorkingItem(null);
    }
  }

  const loading = summaries === null;
  return <main className="page-scroll study-page">
    <AppHeader />
    <section className="utility-heading study-heading">
      <h1>Training</h1>
      {summaries && summaries.length > 0 && <label className="study-player-select"><span>Player</span><select value={playerKey} onChange={(event) => { playerSelectionTouched.current = true; setPlayerKey(event.target.value); }}>{summaries.map((summary) => <option key={summary.key} value={summary.key}>{summary.name} · {summary.gameCount} games{summary.provider ? ` · ${summary.provider === "chesscom" ? "Chess.com" : "Lichess"}` : " · manual"}</option>)}</select></label>}
    </section>
    {notice && <p className="study-notice" role="status">{notice}</p>}
    {loading ? <section className="study-empty">Loading…</section> : summaries.length === 0 ? <>
      {accounts.length > 0 && <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} />}
      <section className="study-empty"><strong>{jobs.some((job) => job.items.some((item) => item.status === "cached" || item.status === "completed")) ? "Analysis is arriving" : "No current analyses"}</strong><span>{accounts.length > 0 ? `${eligibleSynced.length} synced games match this scope.` : "Sync games or complete an objective review."}</span>{accounts.length === 0 ? <Link className="primary-link" href="/history">Open History</Link> : <div className="empty-history-actions"><label><span>Freshness</span><select value={freshness} onChange={(event) => setFreshness(event.target.value as HistoryAnalysisScopeV1["freshness"])}><option value="all">All matching</option><option value="unanalyzed">Never analyzed</option><option value="stale">Stale only</option></select></label><button type="button" className="primary" disabled={jobWorking} onClick={() => void startHistoryAnalysis()}>{jobWorking ? "Analyzing…" : "Analyze my history"}</button><small>Background analysis · up to {HISTORY_ANALYSIS_CONCURRENCY} games at once.</small></div>}{historyJobGroups.length > 0 && <div className="history-job-list empty-jobs">{historyJobGroups.slice(0, 3).map(({ job, duplicateCount }) => <HistoryJobCard key={job.id} job={job} games={syncedGames} duplicateCount={duplicateCount} compact onControl={controlJob} />)}</div>}</section>
    </> : <>
      <ScopeFilters filters={filters} setFilters={setFilters} timeClasses={timeClasses} openingOptions={openingOptions} />
      <nav className="study-tabs" aria-label="Player intelligence sections">{TABS.map((tab) => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
      {!player || !report ? <section className="study-empty">Loading selected player…</section> : <div className="study-sections">
        {activeTab === "overview" && <section className="study-overview">
          <header className="study-section-heading"><h2>Overview</h2><small>{report.coverage.analyzedGames}/{report.coverage.eligibleGames} eligible games analyzed</small></header>
          <div className="study-metrics">
            <article><span>Games</span><strong>{report.overview.summary.gameCount}</strong><small>{report.overview.summary.analyzedMoveCount} moves</small></article>
            <article><span>Accuracy</span><strong>{formatted(report.overview.summary.averageAccuracy)}</strong></article>
            <article><span>Recent form</span><strong>{report.overview.summary.accuracyChange === undefined ? "—" : `${report.overview.summary.accuracyChange >= 0 ? "+" : ""}${report.overview.summary.accuracyChange.toFixed(1)}`}</strong></article>
            <article><span>Score</span><strong>{formatted(report.overview.scoreRate, "%")}</strong></article>
            <article><span>Error rate</span><strong>{formatted(report.overview.errorRate, "%")}</strong></article>
            <article><span>Open tasks</span><strong>{queue.filter((item) => item.status !== "completed").length}</strong></article>
          </div>
          <div className="study-distributions"><span>Sources: {report.overview.platformDistribution.length === 0 ? "manual" : report.overview.platformDistribution.map((item) => `${item.key === "chesscom" ? "Chess.com" : "Lichess"} ${item.gameCount}`).join(" · ")}</span><span>Time controls: {report.overview.timeControlDistribution.length === 0 ? "not supplied" : report.overview.timeControlDistribution.map((item) => `${item.key} ${item.gameCount}`).join(" · ")}</span></div>
          <ol className="study-trend-chart" aria-label="Accuracy by game">{report.overview.games.slice(-30).map((point) => <li key={point.gameId}><span className="trend-value">{formatted(point.accuracy)}</span><span className="trend-track"><i style={{ height: `${Math.max(2, point.accuracy ?? 0)}%` }} /></span><Link href={`/review/${point.gameId}`} aria-label={`${point.title}, Accuracy ${formatted(point.accuracy)}`}>{point.result === "unknown" ? "·" : point.result[0]?.toUpperCase()}</Link></li>)}</ol>
          <div className="phase-metrics">{(["opening", "middlegame", "endgame"] as const).map((phase) => <div key={phase}><span>{phase}</span><strong>{formatted(report.phases[phase].averageAccuracy)}</strong><small>{formatted(report.phases[phase].errorRate, "%")} errors</small></div>)}</div>
        </section>}

        {activeTab === "ratings" && <section><header className="study-section-heading"><h2>Rating & Form</h2><small>Platforms and time controls stay separate.</small></header>{report.ratings.length === 0 ? <p className="study-section-empty">No rating evidence in this population.</p> : <div className="study-metrics rating-grid">{report.ratings.map((band) => <article key={band.key}><span>{band.provider === "chesscom" ? "Chess.com" : "Lichess"} · {band.timeClass}</span><strong>{band.currentRating ?? "—"}</strong><small>{band.recentRange ? `${band.recentRange.low}–${band.recentRange.high}` : "No recent range"} · {band.sampleSize} games · {band.confidence} confidence</small><small>Performance {band.performanceRating ?? "—"} · next target {band.nextTarget ?? "insufficient sample"}</small></article>)}</div>}</section>}

        {activeTab === "openings" && <section><header className="study-section-heading"><h2>Openings</h2><small>Color-specific, filtered population.</small></header>{report.openings.length === 0 ? <p className="study-section-empty">No recognized openings.</p> : <div className="repertoire-list">{report.openings.slice(0, 40).map((opening) => <article key={opening.key}><span className={`repertoire-color ${opening.color}`}>{opening.color === "white" ? "W" : "B"}</span><div><small>{opening.eco} · {formatted(opening.share, "%")}</small><strong>{opening.name}</strong>{opening.variation && <span>{opening.variation}</span>}<span>{opening.wins}W {opening.draws}D {opening.losses}L</span></div><dl><div><dt>Accuracy</dt><dd>{formatted(opening.averageAccuracy)}</dd></div><div><dt>Recent</dt><dd>{formatted(opening.recentAccuracy)}</dd></div><div><dt>Loss</dt><dd>{formatted(opening.averageWinPercentLoss)}</dd></div><div><dt>Errors</dt><dd>{formatted(opening.errorRate, "%")}</dd></div></dl><div className="training-sources">{opening.problemPositions.map((item) => <Link key={`${item.gameId}:${item.ply}`} href={`/review/${item.gameId}/moves?ply=${item.ply}`}>{item.san} · ply {item.ply}</Link>)}</div></article>)}</div>}</section>}

        {(activeTab === "middlegame" || activeTab === "endgame") && (() => { const phase = report.phases[activeTab]; return <section><header className="study-section-heading"><h2>{activeTab === "middlegame" ? "Middlegame" : "Endgame"}</h2><small>Structural phase evidence; no tablebase claims.</small></header><div className="study-metrics"><article><span>Moves</span><strong>{phase.moveCount}</strong></article><article><span>Error rate</span><strong>{formatted(phase.errorRate, "%")}</strong></article><article><span>Average Win% loss</span><strong>{formatted(phase.averageWinPercentLoss)}</strong></article><article><span>Recent Accuracy</span><strong>{formatted(phase.recentAccuracy)}</strong></article></div><div className="study-metrics"><article><span>Advantages held</span><strong>{phase.advantagePreserved}/{phase.advantageOpportunities}</strong><small>Kept at least 65% winning chances</small></article><article><span>Defensive holds</span><strong>{phase.defensiveHolds}/{phase.defensivePositions}</strong><small>Did not lose more than 2 Win%</small></article><article><span>Missed opportunities</span><strong>{phase.missedOpportunities}</strong><small>Verified annotations only</small></article></div></section>; })()}

        {activeTab === "mistakes" && <section><header className="study-section-heading"><h2>Mistakes</h2><small>Largest objective losses first.</small></header>{report.mistakes.length === 0 ? <p className="study-section-empty">No errors in this population.</p> : <ul className="study-evidence-list">{report.mistakes.slice(0, 60).map((item) => <li key={`${item.gameId}:${item.ply}`}><QualityIcon classification={item.classification} size={22} /><span><strong>{item.san} · {QUALITY_META[item.classification].label}</strong><small>{item.phase} · −{item.winPercentLoss.toFixed(1)} Win%</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Review →</Link></li>)}</ul>}</section>}

        {activeTab === "highlights" && <section><header className="study-section-heading"><h2>Highlights</h2><small>Every item links to its game or exact ply.</small></header><div className="highlight-grid">{report.specialMoves.slice(0, 24).map((item) => <article key={`${item.gameId}:${item.ply}`}><strong>{item.annotations.includes("brilliant") ? "Brilliant" : "Critical"} · {item.san}</strong><small>{new Date(item.playedAt).toLocaleDateString()}</small><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Ply {item.ply} →</Link></article>)}{report.gameHighlights.map((item) => <article key={`${item.kind}:${item.gameId}`}><strong>{item.kind.replaceAll("-", " ")}</strong><small>{item.title}{item.accuracy === undefined ? "" : ` · ${item.accuracy.toFixed(1)} Accuracy`}</small><Link href={item.referencePly ? `/review/${item.gameId}/moves?ply=${item.referencePly}` : `/review/${item.gameId}`}>Open →</Link></article>)}</div>{report.specialMoves.length + report.gameHighlights.length === 0 && <p className="study-section-empty">No verified highlights in this population.</p>}</section>}

        {activeTab === "plan" && <section><header className="study-section-heading"><h2>Plan</h2><small>Ranked from measurable source positions.</small></header>{report.trainingPlan.length === 0 ? <p className="study-section-empty">No recurring weakness has enough evidence yet.</p> : <div className="weakness-grid">{report.weaknesses.map((weakness) => { const itemId = trainingQueueItemId(player.key, weakness.kind); return <article key={weakness.kind}><div className="weakness-head"><span className="weakness-priority">P{weakness.priority}</span><div><strong>{WEAKNESS_COPY[weakness.kind].title}</strong><p>{WEAKNESS_COPY[weakness.kind].description}</p></div></div><div className="weakness-metrics"><span>{formatted(weakness.frequency, "%")} of games</span><span>{weakness.confidence} confidence</span><span>{weakness.trend}</span></div><ul>{weakness.evidence.slice(0, 5).map((item) => <li key={`${item.gameId}:${item.ply}`}><span><strong>{item.san}</strong><small>{item.phase} · −{item.winPercentLoss.toFixed(1)} Win%</small></span><Link href={`/review/${item.gameId}/moves?ply=${item.ply}`}>Review →</Link></li>)}</ul><button type="button" className="secondary" disabled={queueIds.has(itemId) || workingItem !== null} onClick={() => void addWeakness(weakness)}>{queueIds.has(itemId) ? "In queue" : "Add to queue"}</button></article>; })}</div>}
          <div className="training-list">{queue.map((item) => <article key={item.id} className={item.status}><div><span className="training-status">{item.status.replace("-", " ")}</span><strong>{WEAKNESS_COPY[item.weaknessKind].title}</strong><small>{item.version === 2 ? `${item.progress.reviewedPositionCount}/${item.progress.totalPositionCount} positions reviewed` : `${item.evidence.length} saved positions`}</small></div><div className="training-sources">{item.evidence.slice(0, 5).map((source) => <Link key={`${source.gameId}:${source.ply}`} href={`/review/${source.gameId}/moves?ply=${source.ply}`}>{source.san} · ply {source.ply}</Link>)}</div><div className="training-actions"><button type="button" className="primary" disabled={workingItem !== null} onClick={() => void transition(item)}>{queueActionLabel(item.status)}</button><button type="button" className="text-button" disabled={workingItem !== null} onClick={() => void remove(item)}>Remove</button></div></article>)}</div>
        </section>}

        {activeTab === "coverage" && <section><header className="study-section-heading"><h2>Coverage</h2><small>{report.algorithmVersion} · {report.objectiveAlgorithmVersion}</small></header><div className="study-metrics"><article><span>Eligible</span><strong>{report.coverage.eligibleGames}</strong></article><article><span>Current</span><strong>{report.coverage.analyzedGames}</strong><small>{formatted(report.coverage.coverageRate, "%")}</small></article><article><span>Stale</span><strong>{report.coverage.staleGames}</strong></article><article><span>Failed</span><strong>{report.coverage.failedGames}</strong></article></div>{report.coverage.providers && report.coverage.providers.length > 0 && <div className="coverage-provider-grid">{report.coverage.providers.map((item) => <article key={item.provider}><strong>{item.provider === "chesscom" ? "Chess.com" : "Lichess"}</strong><span>{item.analyzedGames}/{item.eligibleGames} current</span><small>{item.staleGames} stale · {item.failedGames} failed</small></article>)}</div>}<p className="study-section-empty">{report.coverage.partial ? "This report is partial. Conclusions use only current compatible analyses." : "This filtered population has complete current analysis coverage."}{filters.openingKeys.length > 0 ? " Opening is known only for current analyses, so coverage remains based on the broader synced scope." : ""} Local objective cache: {(cacheBytes / 1024 / 1024).toFixed(1)} MB.</p>
          {accounts.length > 0 && <div className="history-analysis-controls"><label><span>Account scope</span><select value={jobAccountScope} onChange={(event) => setJobAccountScope(event.target.value as "selected" | "all")}><option value="all">All connected accounts</option><option value="selected" disabled={!player.accountId}>Selected account</option></select></label><label><span>Freshness</span><select value={freshness} onChange={(event) => setFreshness(event.target.value as HistoryAnalysisScopeV1["freshness"])}><option value="all">All matching (reuse cache)</option><option value="unanalyzed">Never analyzed</option><option value="stale">Stale only</option></select></label><button type="button" className="primary" disabled={jobWorking} onClick={() => void startHistoryAnalysis()}>{jobWorking ? "Analyzing…" : "Analyze my history"}</button><small>Background analysis · up to {HISTORY_ANALYSIS_CONCURRENCY} games at once.</small></div>}
          <div className="history-job-list">{historyJobGroups.map(({ job, duplicateCount }) => <HistoryJobCard key={job.id} job={job} games={syncedGames} duplicateCount={duplicateCount} onControl={controlJob} />)}</div>
        </section>}
      </div>}
    </>}
  </main>;
}
