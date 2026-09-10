import { writeLocalData, notifyLocalDataChanged } from "./browser-storage";
import { CLASSIFICATION_MULTI_PV, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import type {
  HistoryAnalysisJobExcludedItemV1,
  HistoryAnalysisJobItemV1,
  HistoryAnalysisJobV1,
  HistoryAnalysisScopeV1,
  SyncedGame,
} from "@chess-review/shared";
import { HISTORY_ANALYSIS_JOB_STORE, openReviewDatabase } from "./browser-storage";
import { analyzeSyncedGame } from "./auto-analysis";
import { getSyncedGame, listSyncedGames } from "./platform-library";

const activeControllers = new Map<string, AbortController>();
/** Keep CPU use bounded while allowing history results to arrive out of order. */
export const HISTORY_ANALYSIS_CONCURRENCY = 2;

// Multiple game workers can finish at the same time. IndexedDB writes are
// read-modify-write operations, so serialize mutations for one job or a late
// worker could overwrite another worker's completed item.
const jobMutationTails = new Map<string, Promise<void>>();

const FINISHED_HISTORY_JOB_STATUSES = new Set<HistoryAnalysisJobV1["status"]>([
  "cancelled",
  "failed",
  "completed",
]);

export function isHistoryAnalysisJobFinished(job: Pick<HistoryAnalysisJobV1, "status">): boolean {
  return FINISHED_HISTORY_JOB_STATUSES.has(job.status);
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Run independent work with a fixed upper bound. The helper is intentionally
 * generic so the concurrency contract is deterministic and testable without
 * opening IndexedDB or creating Stockfish workers.
 */
export async function runBoundedParallel<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Parallel worker concurrency must be a positive integer.");
  }
  const workerCount = Math.min(items.length, concurrency);
  let cursor = 0;
  const results = await Promise.allSettled(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]!, index);
    }
  }));
  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;
}

function normalizeScope(scope: HistoryAnalysisScopeV1): HistoryAnalysisScopeV1 {
  return {
    ...scope,
    providers: [...new Set(scope.providers)].sort(),
    accountIds: [...new Set(scope.accountIds)].sort(),
    timeClasses: [...new Set(scope.timeClasses)].sort(),
  };
}

export function gameMatchesHistoryScope(
  game: SyncedGame,
  scope: HistoryAnalysisScopeV1,
  depth: number,
): boolean {
  if (scope.providers.length > 0 && !scope.providers.includes(game.external.provider)) return false;
  if (scope.accountIds.length > 0 && !scope.accountIds.includes(game.external.accountId)) return false;
  if (scope.dateFrom && game.playedAt < scope.dateFrom) return false;
  if (scope.dateTo && game.playedAt > scope.dateTo) return false;
  if (scope.timeClasses.length > 0 && (!game.timeClass || !scope.timeClasses.includes(game.timeClass))) return false;
  if (scope.rated === "rated" && game.rated !== true) return false;
  if (scope.rated === "casual" && game.rated !== false) return false;
  if (scope.freshness === "unanalyzed" && game.analyzed) return false;
  if (scope.freshness === "stale" && (
    !game.analyzed
    || game.analysisAlgorithmVersion === OBJECTIVE_ALGORITHM_VERSION
      && game.analysisDepth === depth
  )) return false;
  return true;
}

export function selectHistoryAnalysisGames(
  games: readonly SyncedGame[],
  scope: HistoryAnalysisScopeV1,
  depth: number,
): SyncedGame[] {
  const seenIds = new Set<string>();
  const seenPgn = new Set<string>();
  return games
    .filter((game) => gameMatchesHistoryScope(game, scope, depth))
    .sort((left, right) => left.playedAt.localeCompare(right.playedAt) || left.id.localeCompare(right.id))
    .filter((game) => {
      if (seenIds.has(game.id) || seenPgn.has(game.pgn)) return false;
      seenIds.add(game.id);
      seenPgn.add(game.pgn);
      return true;
    });
}

export interface PartitionedHistoryAnalysisCandidates {
  /** Games whose PGN parses and may enter the analysis queue. */
  valid: SyncedGame[];
  /** Structurally invalid games with the rules-layer reason, never queued. */
  excluded: HistoryAnalysisJobExcludedItemV1[];
}

/**
 * A PGN that fails chess rules parsing ("Invalid FEN: missing black king", for
 * example) can never produce an analysis. Partitioning before job creation
 * keeps such provider-side data problems out of the retryable failure loop;
 * they are reported on the job instead.
 */
export function partitionUnparsableSyncedGames(games: readonly SyncedGame[]): PartitionedHistoryAnalysisCandidates {
  const valid: SyncedGame[] = [];
  const excluded: HistoryAnalysisJobExcludedItemV1[] = [];
  for (const synced of games) {
    try {
      parsePgn(synced.pgn);
      valid.push(synced);
    } catch (error) {
      excluded.push({
        gameId: synced.id,
        reason: error instanceof Error ? error.message : "PGN cannot be parsed.",
      });
    }
  }
  return { valid, excluded };
}

export function pauseHistoryAnalysisJobRecord(job: HistoryAnalysisJobV1, timestamp: string): HistoryAnalysisJobV1 {
  const updated = {
    ...job,
    status: "paused" as const,
    items: job.items.map((item) => item.status === "running"
      ? { ...item, status: "queued" as const, updatedAt: timestamp }
      : item),
    updatedAt: timestamp,
  };
  delete updated.completedAt;
  return updated;
}

export function cancelHistoryAnalysisJobRecord(job: HistoryAnalysisJobV1, timestamp: string): HistoryAnalysisJobV1 {
  return {
    ...job,
    status: "cancelled",
    items: job.items.map((item) => ["queued", "running"].includes(item.status)
      ? { ...item, status: "cancelled" as const, updatedAt: timestamp }
      : item),
    updatedAt: timestamp,
    completedAt: timestamp,
  };
}

export function retryFailedHistoryAnalysisJobRecord(
  job: HistoryAnalysisJobV1,
  timestamp: string,
  unparsableGameIds: readonly string[] = [],
): HistoryAnalysisJobV1 {
  const unparsable = new Set(unparsableGameIds);
  const excludedById = new Map((job.excludedItems ?? []).map((item) => [item.gameId, item]));
  const migratedExcluded: HistoryAnalysisJobExcludedItemV1[] = [...(job.excludedItems ?? [])];
  const items = job.items.flatMap((item) => {
    if (item.status !== "failed") return [item];
    // An unparsable provider PGN can never succeed. Move it out of items so it
    // cannot keep the job in Partial/Failed or re-enter retry accounting.
    if (unparsable.has(item.gameId)) {
      if (!excludedById.has(item.gameId)) {
        const reason = item.error ?? "Invalid PGN from the provider.";
        migratedExcluded.push({ gameId: item.gameId, reason });
        excludedById.set(item.gameId, { gameId: item.gameId, reason });
      }
      return [];
    }
    const reset = { ...item, status: "queued" as const, updatedAt: timestamp };
    delete reset.error;
    return [reset];
  });
  const hasRetryable = items.some((item) => item.status === "queued" || item.status === "running");
  const hasFailures = items.some((item) => item.status === "failed");
  const updated = {
    ...job,
    status: hasRetryable ? "queued" as const : hasFailures ? "failed" as const : "completed" as const,
    items,
    updatedAt: timestamp,
  };
  if (updated.status === "queued") {
    delete updated.completedAt;
    delete updated.error;
  } else {
    updated.completedAt = timestamp;
    if (updated.status === "completed") delete updated.error;
  }
  if (migratedExcluded.length > 0) updated.excludedItems = migratedExcluded;
  return updated;
}

async function writeJob(job: HistoryAnalysisJobV1): Promise<HistoryAnalysisJobV1> {
  const database = await openReviewDatabase();
  try {
    await writeLocalData(database, HISTORY_ANALYSIS_JOB_STORE, (transaction) => {
      transaction.objectStore(HISTORY_ANALYSIS_JOB_STORE).put(job, job.id);
    });
    notifyLocalDataChanged();
    return job;
  } finally {
    database.close();
  }
}

async function mutateHistoryAnalysisJob(
  id: string,
  mutate: (job: HistoryAnalysisJobV1) => HistoryAnalysisJobV1,
): Promise<HistoryAnalysisJobV1> {
  const previous = jobMutationTails.get(id) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  jobMutationTails.set(id, current);
  await previous.catch(() => undefined);
  try {
    const latest = await getHistoryAnalysisJob(id);
    if (!latest) throw new Error("History-analysis job no longer exists.");
    return await writeJob(mutate(latest));
  } finally {
    release();
    if (jobMutationTails.get(id) === current) jobMutationTails.delete(id);
  }
}

export async function getHistoryAnalysisJob(id: string): Promise<HistoryAnalysisJobV1 | null> {
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(HISTORY_ANALYSIS_JOB_STORE, "readonly").objectStore(HISTORY_ANALYSIS_JOB_STORE).get(id);
      request.onsuccess = () => resolve((request.result as HistoryAnalysisJobV1 | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read the history-analysis job."));
    });
  } finally {
    database.close();
  }
}

export async function listHistoryAnalysisJobs(): Promise<HistoryAnalysisJobV1[]> {
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(HISTORY_ANALYSIS_JOB_STORE, "readonly").objectStore(HISTORY_ANALYSIS_JOB_STORE).getAll();
      request.onsuccess = () => resolve((request.result as HistoryAnalysisJobV1[])
        .filter((job) => job.version === 1)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      request.onerror = () => reject(request.error ?? new Error("Unable to list history-analysis jobs."));
    });
  } finally {
    database.close();
  }
}

/**
 * Remove only the durable batch-run record. Source games, review records,
 * objective analyses, projections and Training data intentionally stay intact.
 */
export async function removeHistoryAnalysisJob(id: string): Promise<boolean> {
  if (activeControllers.has(id)) {
    throw new Error("Stop the active history analysis before removing its run history.");
  }
  const job = await getHistoryAnalysisJob(id);
  if (!job) return false;
  if (!isHistoryAnalysisJobFinished(job)) {
    throw new Error("Cancel this history analysis before removing its run history.");
  }
  const database = await openReviewDatabase();
  try {
    await writeLocalData(database, HISTORY_ANALYSIS_JOB_STORE, (transaction) => {
      transaction.objectStore(HISTORY_ANALYSIS_JOB_STORE).delete(id);
    });
    notifyLocalDataChanged();
    return true;
  } finally {
    database.close();
  }
}

/** Remove all completed/failed/cancelled run records in one transaction. */
export async function clearFinishedHistoryAnalysisJobs(): Promise<number> {
  const jobs = await listHistoryAnalysisJobs();
  const ids = jobs.filter(isHistoryAnalysisJobFinished).map(({ id }) => id).filter((id) => !activeControllers.has(id));
  if (ids.length === 0) return 0;
  const database = await openReviewDatabase();
  try {
    await writeLocalData(database, HISTORY_ANALYSIS_JOB_STORE, (transaction) => {
      const store = transaction.objectStore(HISTORY_ANALYSIS_JOB_STORE);
      for (const id of ids) store.delete(id);
    });
    notifyLocalDataChanged();
    return ids.length;
  } finally {
    database.close();
  }
}

export async function createHistoryAnalysisJob(
  scope: HistoryAnalysisScopeV1,
  depth: 10 | 12 | 15,
  sourceGames?: readonly SyncedGame[],
  excludedItems: readonly HistoryAnalysisJobExcludedItemV1[] = [],
): Promise<HistoryAnalysisJobV1> {
  const normalized = normalizeScope(scope);
  const games = selectHistoryAnalysisGames(sourceGames ?? await listSyncedGames(), normalized, depth);
  const timestamp = now();
  const items: HistoryAnalysisJobItemV1[] = games.map((game) => ({
    gameId: game.id,
    status: "queued",
    attempts: 0,
    updatedAt: timestamp,
  }));
  return writeJob({
    version: 1,
    id: crypto.randomUUID(),
    status: items.length === 0 ? "completed" : "queued",
    scope: normalized,
    objectiveAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    depth,
    classificationMultiPv: CLASSIFICATION_MULTI_PV,
    items,
    ...(excludedItems.length > 0 ? { excludedItems: [...excludedItems] } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(items.length === 0 ? { completedAt: timestamp } : {}),
  });
}

function sameHistoryJobRequest(
  job: HistoryAnalysisJobV1,
  scope: HistoryAnalysisScopeV1,
  depth: number,
  gameIds: readonly string[],
): boolean {
  return job.depth === depth
    && job.objectiveAlgorithmVersion === OBJECTIVE_ALGORITHM_VERSION
    && job.classificationMultiPv === CLASSIFICATION_MULTI_PV
    && JSON.stringify(job.scope) === JSON.stringify(scope)
    && JSON.stringify(job.items.map((item) => item.gameId).sort()) === JSON.stringify([...gameIds].sort());
}

function scopeWithoutFreshness(scope: HistoryAnalysisScopeV1) {
  return {
    providers: scope.providers,
    accountIds: scope.accountIds,
    timeClasses: scope.timeClasses,
    rated: scope.rated,
    dateFrom: scope.dateFrom ?? null,
    dateTo: scope.dateTo ?? null,
  };
}

export function historyJobsShareSemanticScope(left: HistoryAnalysisJobV1, right: HistoryAnalysisJobV1): boolean {
  return left.depth === right.depth
    && left.objectiveAlgorithmVersion === right.objectiveAlgorithmVersion
    && left.classificationMultiPv === right.classificationMultiPv
    && JSON.stringify(scopeWithoutFreshness(left.scope)) === JSON.stringify(scopeWithoutFreshness(right.scope));
}

export function historyJobCovers(newer: HistoryAnalysisJobV1, older: HistoryAnalysisJobV1): boolean {
  const newerIds = new Set(newer.items.map((item) => item.gameId));
  return older.items.length > 0 && older.items.every((item) => newerIds.has(item.gameId));
}

const SUPERSEDEABLE_STATUSES = new Set<HistoryAnalysisJobV1["status"]>(["queued", "paused", "failed"]);

export function shouldSupersedeHistoryJob(newer: HistoryAnalysisJobV1, older: HistoryAnalysisJobV1): boolean {
  if (newer.id === older.id || older.supersededBy) return false;
  if (!SUPERSEDEABLE_STATUSES.has(older.status)) return false;
  if (newer.status === "cancelled" || newer.supersededBy) return false;
  if (!historyJobsShareSemanticScope(newer, older)) return false;
  if (historyJobCovers(newer, older)) return true;
  const newerIds = new Set(newer.items.map((item) => item.gameId));
  const overlapping = older.items.some((item) => newerIds.has(item.gameId));
  return overlapping && newer.items.length > older.items.length;
}

export function planHistoryJobSupersession(
  jobs: readonly HistoryAnalysisJobV1[],
): Array<{ older: HistoryAnalysisJobV1; newer: HistoryAnalysisJobV1 }> {
  const chronological = [...jobs].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const replaced = new Set<string>();
  const decisions: Array<{ older: HistoryAnalysisJobV1; newer: HistoryAnalysisJobV1 }> = [];
  for (let index = chronological.length - 1; index >= 0; index -= 1) {
    const newer = chronological[index]!;
    if (newer.supersededBy || newer.status === "cancelled") continue;
    for (const older of chronological.slice(0, index)) {
      if (replaced.has(older.id) || !shouldSupersedeHistoryJob(newer, older)) continue;
      replaced.add(older.id);
      decisions.push({ older, newer });
    }
  }
  return decisions;
}

export function markHistoryJobSuperseded(
  job: HistoryAnalysisJobV1,
  supersededBy: string,
  timestamp: string,
): HistoryAnalysisJobV1 {
  return {
    ...cancelHistoryAnalysisJobRecord(job, timestamp),
    supersededBy,
    error: "Replaced by a later analysis of this scope.",
  };
}

async function persistHistoryJobSupersession(
  jobs?: readonly HistoryAnalysisJobV1[],
): Promise<HistoryAnalysisJobV1[]> {
  const current = jobs ?? await listHistoryAnalysisJobs();
  const decisions = planHistoryJobSupersession(current);
  if (decisions.length === 0) return [...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const timestamp = now();
  for (const { older, newer } of decisions) {
    if (activeControllers.has(older.id)) continue;
    await mutateHistoryAnalysisJob(older.id, (job) => (
      job.supersededBy ? job : markHistoryJobSuperseded(job, newer.id, timestamp)
    ));
  }
  return listHistoryAnalysisJobs();
}

/**
 * Reuse a persisted request with the same scope and game set. This prevents a
 * second click (or a remounted page) from creating another copy of a long
 * history job. Failed jobs are returned for the caller to retry explicitly.
 */
export async function createOrReuseHistoryAnalysisJob(
  scope: HistoryAnalysisScopeV1,
  depth: 10 | 12 | 15,
  sourceGames?: readonly SyncedGame[],
): Promise<{ job: HistoryAnalysisJobV1; reused: boolean }> {
  const normalized = normalizeScope(scope);
  const scopedSourceGames = (sourceGames ?? await listSyncedGames()).filter((game) => gameMatchesHistoryScope(game, normalized, depth));
  const candidates = partitionUnparsableSyncedGames(scopedSourceGames);
  const games = selectHistoryAnalysisGames(candidates.valid, normalized, depth);
  const gameIds = games.map((game) => game.id);
  const existing = (await listHistoryAnalysisJobs()).find((job) => sameHistoryJobRequest(job, normalized, depth, gameIds));
  if (existing) return { job: existing, reused: true };
  const created = await createHistoryAnalysisJob(normalized, depth, games, candidates.excluded);
  await persistHistoryJobSupersession();
  return { job: created, reused: false };
}

export interface AutomaticHistoryAnalysisResult {
  /** The durable job that owns the queued work, when there is work to do. */
  job: HistoryAnalysisJobV1 | null;
  /** Number of items that are still queued or currently running. */
  queuedCount: number;
  /** True when an existing job was reused instead of creating another one. */
  reused: boolean;
}

function automaticScope(accountId: string): HistoryAnalysisScopeV1 {
  return {
    providers: [],
    accountIds: [accountId],
    timeClasses: [],
    rated: "all",
    freshness: "unanalyzed",
  };
}

function isAutomaticAccountJob(job: HistoryAnalysisJobV1, accountId: string, depth: number): boolean {
  return job.depth === depth
    && job.objectiveAlgorithmVersion === OBJECTIVE_ALGORITHM_VERSION
    && job.classificationMultiPv === CLASSIFICATION_MULTI_PV
    && job.scope.freshness === "unanalyzed"
    && job.scope.providers.length === 0
    && job.scope.timeClasses.length === 0
    && job.scope.rated === "all"
    && job.scope.accountIds.length === 1
    && job.scope.accountIds[0] === accountId
    && job.scope.dateFrom === undefined
    && job.scope.dateTo === undefined;
}

/**
 * Start durable objective analysis for every currently unanalysed game in an
 * account. This is intentionally fire-and-forget: syncing remains responsive
 * while the Training page observes the persisted job and its completed items.
 */
export async function queueAutomaticHistoryAnalysis(
  accountId: string,
  depth: 10 | 12 | 15,
): Promise<AutomaticHistoryAnalysisResult> {
  const scope = automaticScope(accountId);
  const [games, jobs] = await Promise.all([listSyncedGames(), listHistoryAnalysisJobs()]);
  const scopedGames = games.filter((game) => gameMatchesHistoryScope(game, scope, depth));
  const { valid, excluded } = partitionUnparsableSyncedGames(scopedGames);
  const candidates = selectHistoryAnalysisGames(valid, scope, depth);
  const matching = jobs.filter((job) => isAutomaticAccountJob(job, accountId, depth) && !job.supersededBy);
  const existing = matching.find((job) => job.status === "running" || job.status === "queued" || job.status === "paused");
  if (existing) {
    const existingIds = new Set(existing.items.map((item) => item.gameId));
    const uncovered = candidates.filter((game) => !existingIds.has(game.id));
    if (uncovered.length === 0 || existing.status === "running") {
      return {
        job: existing,
        queuedCount: existing.items.filter((item) => item.status === "queued" || item.status === "running").length,
        reused: true,
      };
    }
  }
  const candidateIds = candidates.map((game) => game.id).sort();
  const retryable = matching.find((job) => {
    if (job.status !== "failed") return false;
    const failedIds = job.items.filter((item) => item.status === "failed").map((item) => item.gameId).sort();
    const finishedOnly = job.items.every((item) => item.status === "failed" || item.status === "cached" || item.status === "completed");
    return finishedOnly && JSON.stringify(failedIds) === JSON.stringify(candidateIds);
  });
  if (retryable) {
    const retried = await retryFailedHistoryAnalysisItems(retryable.id);
    void runHistoryAnalysisJob(retried.id).catch(() => undefined);
    return { job: retried, queuedCount: retried.items.filter((item) => item.status === "queued").length, reused: true };
  }
  if (candidates.length === 0) {
    const latest = matching[0] ?? null;
    return {
      job: latest,
      queuedCount: 0,
      reused: latest !== null,
    };
  }
  const job = await createHistoryAnalysisJob(scope, depth, valid, excluded);
  await persistHistoryJobSupersession();
  void runHistoryAnalysisJob(job.id).catch(() => undefined);
  return { job, queuedCount: job.items.length, reused: false };
}

export async function pauseHistoryAnalysisJob(id: string): Promise<HistoryAnalysisJobV1> {
  const updated = await mutateHistoryAnalysisJob(id, (job) => pauseHistoryAnalysisJobRecord(job, now()));
  activeControllers.get(id)?.abort();
  return updated;
}

export async function cancelHistoryAnalysisJob(id: string): Promise<HistoryAnalysisJobV1> {
  const updated = await mutateHistoryAnalysisJob(id, (job) => cancelHistoryAnalysisJobRecord(job, now()));
  activeControllers.get(id)?.abort();
  return updated;
}

export async function retryFailedHistoryAnalysisItems(id: string): Promise<HistoryAnalysisJobV1> {
  const [games] = await Promise.all([listSyncedGames()]);
  const { excluded } = partitionUnparsableSyncedGames(games);
  return mutateHistoryAnalysisJob(id, (job) => retryFailedHistoryAnalysisJobRecord(job, now(), excluded.map((item) => item.gameId)));
}

export async function recoverInterruptedHistoryJobs(): Promise<HistoryAnalysisJobV1[]> {
  const jobs = await listHistoryAnalysisJobs();
  const recovered: HistoryAnalysisJobV1[] = [];
  for (const job of jobs) {
    if (job.status !== "running" || activeControllers.has(job.id)) {
      recovered.push(job);
      continue;
    }
    const updated = pauseHistoryAnalysisJobRecord(job, now());
    updated.error = "Browser work was interrupted. Resume to continue from the saved queue.";
    recovered.push(await writeJob(updated));
  }
  return persistHistoryJobSupersession(recovered);
}

export async function runHistoryAnalysisJob(
  id: string,
  onUpdate?: (job: HistoryAnalysisJobV1) => void,
): Promise<HistoryAnalysisJobV1> {
  if (activeControllers.has(id)) return (await getHistoryAnalysisJob(id))!;
  let job = await getHistoryAnalysisJob(id);
  if (!job) throw new Error("History-analysis job no longer exists.");
  if (["cancelled", "completed"].includes(job.status)) return job;
  const controller = new AbortController();
  activeControllers.set(id, controller);
  try {
    const startedAt = job.startedAt ?? now();
    job = await mutateHistoryAnalysisJob(id, (latest) => {
      if (["cancelled", "completed"].includes(latest.status)) return latest;
      const runningJob = { ...latest, status: "running" as const, startedAt, updatedAt: now() };
      delete runningJob.error;
      return runningJob;
    });
    onUpdate?.(job);

    if (job.status !== "running" || controller.signal.aborted) return job;
    const queuedIndexes = job.items.flatMap((item, index) => item.status === "queued" ? [index] : []);

    await runBoundedParallel(queuedIndexes, HISTORY_ANALYSIS_CONCURRENCY, async (index) => {
      const runningJob = await mutateHistoryAnalysisJob(id, (latest) => {
        if (latest.status !== "running" || controller.signal.aborted) return latest;
        const item = latest.items[index];
        if (!item || item.status !== "queued") return latest;
        const timestamp = now();
        const runningItem = {
          ...item,
          status: "running" as const,
          attempts: item.attempts + 1,
          updatedAt: timestamp,
        };
        return {
          ...latest,
          items: latest.items.map((entry, itemIndex) => itemIndex === index ? runningItem : entry),
          updatedAt: timestamp,
        };
      });

      const item = runningJob.items[index];
      if (runningJob.status !== "running" || item?.status !== "running" || controller.signal.aborted) {
        onUpdate?.(runningJob);
        return;
      }
      onUpdate?.(runningJob);

      try {
        const game = await getSyncedGame(item.gameId);
        if (!game) throw new Error("Synced game is no longer available.");
        const result = await analyzeSyncedGame(game, {
          depth: runningJob.depth as 10 | 12 | 15,
          signal: controller.signal,
        });
        const completedAt = now();
        const completedJob = await mutateHistoryAnalysisJob(id, (latest) => {
          const currentItem = latest.items[index];
          if (!currentItem || currentItem.status !== "running") return latest;
          return {
            ...latest,
            items: latest.items.map((entry, itemIndex) => itemIndex === index ? {
              ...entry,
              status: result.cached ? "cached" as const : "completed" as const,
              analysisId: result.analysisId,
              updatedAt: completedAt,
            } : entry),
            updatedAt: completedAt,
          };
        });
        onUpdate?.(completedJob);
      } catch (error) {
        const persisted = await getHistoryAnalysisJob(id);
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          if (persisted) onUpdate?.(persisted);
          return;
        }
        const failedAt = now();
        const failedJob = await mutateHistoryAnalysisJob(id, (latest) => {
          const currentItem = latest.items[index];
          if (!currentItem || currentItem.status !== "running") return latest;
          return {
            ...latest,
            items: latest.items.map((entry, itemIndex) => itemIndex === index ? {
              ...entry,
              status: "failed" as const,
              error: error instanceof Error ? error.message : "Game analysis failed.",
              updatedAt: failedAt,
            } : entry),
            updatedAt: failedAt,
          };
        });
        onUpdate?.(failedJob);
      }
    });

    const latest = await getHistoryAnalysisJob(id);
    if (!latest) throw new Error("History-analysis job no longer exists.");
    if (latest.status !== "running" || controller.signal.aborted) return latest;
    const finishedAt = now();
    const hasFailures = latest.items.some((item) => item.status === "failed");
    job = await mutateHistoryAnalysisJob(id, (current) => {
      if (current.status !== "running" || controller.signal.aborted) return current;
      return {
        ...current,
        status: hasFailures ? "failed" : "completed",
        updatedAt: finishedAt,
        completedAt: finishedAt,
        ...(hasFailures ? { error: "Some games failed. Successful analyses remain available in Training." } : {}),
      };
    });
    onUpdate?.(job);
    return job;
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return (await getHistoryAnalysisJob(id)) ?? job;
    }
    const failedAt = now();
    const persisted = await getHistoryAnalysisJob(id);
    if (persisted?.status === "running") {
      job = await mutateHistoryAnalysisJob(id, (latest) => latest.status === "running" ? {
        ...latest,
        status: "failed",
        error: error instanceof Error ? error.message : "History analysis failed.",
        updatedAt: failedAt,
        completedAt: failedAt,
      } : latest);
      onUpdate?.(job);
      return job;
    }
    throw error;
  } finally {
    activeControllers.delete(id);
  }
}
