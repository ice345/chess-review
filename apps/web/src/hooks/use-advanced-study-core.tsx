"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  SyncedGame,
  TrainingQueueItemV3,
} from "@chess-review/shared";
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
  isHistoryAnalysisJobFinished,
  listHistoryAnalysisJobs,
  pauseHistoryAnalysisJob,
  recoverInterruptedHistoryJobs,
  removeHistoryAnalysisJob,
  retryFailedHistoryAnalysisItems,
  runHistoryAnalysisJob,
} from "../lib/history-analysis-jobs";
import { listPlatformAccounts, listSyncedGames } from "../lib/platform-library";
import { createTrainingQueueItem, listTrainingQueue, saveTrainingQueueItem } from "../lib/training-queue";
import {
  collapseHistoryJobs,
  DEFAULT_FILTERS,
  liveAnalysisStatus,
  WEAKNESS_COPY,
} from "../components/advanced-study/study-helpers";

type QueueItem = TrainingQueueItemV3;

/**
 * Shared Practice/Stats data plane: player library, filters, history jobs, report.
 * Surface hooks add Practice chapter furniture or Stats report view-models.
 */
export function useAdvancedStudyCore() {
  const settings = useMemo(() => loadAppSettings(), []);
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
  const [freshness, setFreshness] = useState<HistoryAnalysisScopeV1["freshness"]>("all");
  const [jobAccountScope, setJobAccountScope] = useState<"selected" | "all">("all");
  const [cacheBytes, setCacheBytes] = useState(0);
  const [queueState, setQueueState] = useState<"loading" | "ready" | "failed">("loading");
  const [sourcesFailed, setSourcesFailed] = useState(false);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [jobWorking, setJobWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [playerRevision, setPlayerRevision] = useState(0);
  const queueWorking = useRef(false);
  const playerSelectionTouched = useRef(false);
  const previousActiveJobs = useRef<string | null>(null);
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
    let active = true;
    if (!playerKey) {
      setPlayer(null);
      setQueue([]);
      loadedQueueKey.current = null;
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
    if (player && player.kind !== "connected-account") return false;
    if (coverageAccountIds.length > 0 && !coverageAccountIds.includes(game.external.accountId)) return false;
    if (filters.providers.length > 0 && !filters.providers.includes(game.external.provider)) return false;
    if (filters.timeClasses.length > 0 && (!game.timeClass || !filters.timeClasses.includes(game.timeClass))) return false;
    if (filters.rated === "rated" && game.rated !== true) return false;
    if (filters.rated === "casual" && game.rated !== false) return false;
    if (filters.playerColors.length > 0 && !filters.playerColors.includes(game.accountColor)) return false;
    if (filters.dateFrom && game.playedAt < filters.dateFrom) return false;
    if (filters.dateTo && game.playedAt > filters.dateTo) return false;
    return true;
  }), [coverageAccountIds, filters, syncedGames, player]);
  const failedGameIds = useMemo(() => new Set(jobs.filter((job) => !job.supersededBy).flatMap((job) => job.items.filter((item) => item.status === "failed").map((item) => item.gameId))), [jobs]);
  const excludedGameIds = useMemo(() => new Set(jobs.flatMap((job) => (job.excludedItems ?? []).map((item) => item.gameId))), [jobs]);
  const historyJobGroups = useMemo(() => collapseHistoryJobs(jobs), [jobs]);
  const coverage = useMemo(() => {
    if (player?.kind !== "connected-account") {
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
    if (!window.confirm("Remove this run from history? Synced games, reviews, Stockfish analyses and Practice data will stay.")) return;
    try {
      await removeHistoryAnalysisJob(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      setNotice("Analysis run removed. Synced games and Practice data were kept.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to remove this history run.");
    }
  }

  async function clearFinishedRuns() {
    if (!window.confirm("Clear finished analysis runs? This removes only run history; synced games, reviews, Stockfish analyses and Practice data will stay.")) return;
    try {
      const removed = await clearFinishedHistoryAnalysisJobs();
      setJobs((current) => current.filter((job) => !isHistoryAnalysisJobFinished(job)));
      setNotice(removed === 0 ? "No finished analysis runs to clear." : `${removed} finished analysis run${removed === 1 ? "" : "s"} cleared. Practice data was kept.`);
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

  function retryTrainingToday() {
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
  const analysisStatus = useMemo(() => liveAnalysisStatus(jobs), [jobs]);
  const scopeGameCount = report?.overview.summary.gameCount ?? (player?.games.length ?? eligibleSynced.length);
  const availableGames = player === null ? 0 : player.games.length;
  const unanalyzedEligibleCount = eligibleSynced.filter((game) => !excludedGameIds.has(game.id) && !game.analyzed).length;
  const canAnalyzeHistory = accounts.length > 0 && unanalyzedEligibleCount > 0 && !hasActiveHistoryJob;
  const showRunHistory = historyJobGroups.length > 0;

  const playerSelect: ReactNode = summaries && summaries.length > 0 ? <label className="study-player-select"><span>Whose games</span><select value={playerKey} onChange={(event) => { playerSelectionTouched.current = true; setPlayerKey(event.target.value); }}>{summaries.map((summary) => <option key={summary.key} value={summary.key}>{summary.name} · {summary.gameCount} {summary.gameCount === 1 ? "game" : "games"}{summary.color ? ` · ${summary.color === "white" ? "White" : "Black"}` : ""}{summary.provider ? ` · ${summary.provider === "chesscom" ? "Chess.com" : "Lichess"}` : " · manual"}</option>)}</select></label> : null;

  return {
    settings,
    scopedPlayerKey,
    focusedTaskId,
    summaries,
    playerKey,
    setPlayerKey,
    player,
    accounts,
    syncedGames,
    jobs,
    queue,
    filters,
    setFilters,
    scopeOpen,
    setScopeOpen,
    freshness,
    setFreshness,
    jobAccountScope,
    setJobAccountScope,
    cacheBytes,
    queueState,
    sourcesFailed,
    workingItem,
    jobWorking,
    notice,
    timeClasses,
    compatibleGames,
    openingOptions,
    selectedAccountIds,
    coverageAccountIds,
    eligibleSynced,
    failedGameIds,
    excludedGameIds,
    historyJobGroups,
    coverage,
    report,
    queueIds,
    startHistoryAnalysis,
    controlJob,
    removeHistoryRun,
    clearFinishedRuns,
    addWeakness,
    loading,
    retryTrainingToday,
    todayState,
    analysisStatus,
    scopeGameCount,
    availableGames,
    unanalyzedEligibleCount,
    canAnalyzeHistory,
    showRunHistory,
    playerSelect,
    playerSelectionTouched,
    hasActiveHistoryJob,
  } as const;
}

export type AdvancedStudyCore = ReturnType<typeof useAdvancedStudyCore>;
