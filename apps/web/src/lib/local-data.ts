import type { AnalysisCacheProjectionV1, GameAnalysisV2, HistoryAnalysisJobV1, PlatformSyncState, SyncedGame, TrainingQueueItem } from "@chess-review/shared";
import { normalizeTrainingItem } from "./training-queue";
import { parsePgn } from "@chess-review/chess-core";
import {
  ANALYSIS_INDEX_STORE, ANALYSIS_STORE, DATA_STORES, EPOCH_KEY,
  HISTORY_ANALYSIS_JOB_STORE, LOCAL_META_STORE, notifyLocalDataChanged, openReviewDatabase, REMOTE_POSITIONS_STORE,
  PLATFORM_ACCOUNT_STORE, PLATFORM_SYNC_STORE, REVIEW_STORE, REVIEW_RUN_STORE, NOTEBOOK_STORE,
  SYNCED_GAME_STORE, TRAINING_QUEUE_STORE, writeLocalData,
} from "./browser-storage";
import { DEFAULT_APP_SETTINGS } from "./app-settings";
import type { ReviewRecord } from "./review-library";

export function deletedReviewKey(id: string): string { return `deleted-review:${id}`; }
export function deletedExternalKey(external: NonNullable<ReviewRecord["external"]>): string {
  return `deleted-source:${external.provider}:${external.accountId}:${external.externalGameId}`;
}

function identity(input: string): string | null {
  try { const game = parsePgn(input); return [game.initialFen, ...game.plies.map((move) => move.uci)].join("\u0000"); }
  catch { return null; }
}

function withoutAnalysis(game: SyncedGame): SyncedGame {
  const next = { ...game, analyzed: false };
  delete next.analysisId;
  delete next.analysisAlgorithmVersion;
  delete next.analysisDepth;
  delete next.analyzedAt;
  return next;
}

type Cleanup = { kind: "review"; id: string } | { kind: "account"; id: string; disconnect: boolean } | { kind: "cache" | "all" };

/** One atomic cleanup, including epoch invalidation and durable job pauses. */
async function cleanup(scope: Cleanup): Promise<number> {
  const db = await openReviewDatabase();
  let removedGames = 0;
  try {
    await writeLocalData(db, DATA_STORES, (tx) => {
      const meta = tx.objectStore(LOCAL_META_STORE);
      const epoch = meta.get(EPOCH_KEY);
      epoch.onsuccess = () => {
        if (scope.kind === "all") {
          for (const store of DATA_STORES) tx.objectStore(store).clear();
          meta.clear();
        }
        meta.put((epoch.result ?? 0) + 1, EPOCH_KEY);
      };
      if (scope.kind === "all") return;
      const recordsRequest = tx.objectStore(REVIEW_STORE).getAll();
      const gamesRequest = tx.objectStore(SYNCED_GAME_STORE).getAll();
      let remainingReads = 2;
      const ready = () => {
        if (--remainingReads > 0) return;
        const records = recordsRequest.result as ReviewRecord[];
        const games = gamesRequest.result as SyncedGame[];
        const removed = records.filter((record) => scope.kind === "review" ? record.id === scope.id : scope.kind === "account" && record.external?.accountId === scope.id);
        const removedIds = new Set(removed.map((record) => record.id));
        const sources = games.filter((game) => scope.kind === "account" && game.external.accountId === scope.id);
        const sourceIds = new Set(sources.map((game) => game.id));
        removedGames = sources.length;
        // Record the intent even if an old page raced with a prior deletion.
        if (scope.kind === "review") meta.put(true, deletedReviewKey(scope.id));
        for (const record of removed) {
          tx.objectStore(REVIEW_STORE).delete(record.id);
          tx.objectStore(REVIEW_RUN_STORE).delete(record.id);
          tx.objectStore(NOTEBOOK_STORE).delete(record.id);
          meta.put(true, deletedReviewKey(record.id));
          if (record.external) meta.put(true, deletedExternalKey(record.external));
        }
        for (const game of sources) {
          tx.objectStore(SYNCED_GAME_STORE).delete(game.id);
          meta.put(true, deletedExternalKey(game.external));
        }
        if (scope.kind === "account") {
          tx.objectStore(PLATFORM_SYNC_STORE).delete(scope.id);
          if (scope.disconnect) tx.objectStore(PLATFORM_ACCOUNT_STORE).delete(scope.id);
        }
        for (const game of games) {
          if (!sourceIds.has(game.id) && (scope.kind === "cache" || removed.some((record) => record.external && deletedExternalKey(record.external) === deletedExternalKey(game.external)))) {
            tx.objectStore(SYNCED_GAME_STORE).put(withoutAnalysis(game), game.id);
          }
        }
        if (scope.kind === "cache") {
          tx.objectStore(ANALYSIS_STORE).clear();
          tx.objectStore(ANALYSIS_INDEX_STORE).clear();
          // Third-party position lookups are derived reference data as well.
          tx.objectStore(REMOTE_POSITIONS_STORE).clear();
        } else {
          // Cached positions can be shared by manual imports and other accounts.
          const targeted = new Set([...removed.filter((r) => r.kind === "pgn").map((r) => identity(r.input)), ...sources.map((g) => identity(g.pgn))].filter((v): v is string => v !== null));
          const retained = new Set([...records.filter((r) => !removedIds.has(r.id) && r.kind === "pgn").map((r) => identity(r.input)), ...games.filter((g) => !sourceIds.has(g.id)).map((g) => identity(g.pgn))].filter((v): v is string => v !== null));
          const cursor = tx.objectStore(ANALYSIS_STORE).openCursor();
          cursor.onsuccess = () => {
            const entry = cursor.result;
            if (!entry) return;
            const cached = entry.value as GameAnalysisV2;
            const key = cached.game?.pgn ? identity(cached.game.pgn) : null;
            if (key && targeted.has(key) && !retained.has(key)) {
              entry.delete();
              tx.objectStore(ANALYSIS_INDEX_STORE).delete(entry.primaryKey);
            }
            entry.continue();
          };
          const index = tx.objectStore(ANALYSIS_INDEX_STORE).openCursor();
          index.onsuccess = () => {
            const entry = index.result;
            if (!entry) return;
            const projection = entry.value as AnalysisCacheProjectionV1;
            const key = projection.initialFen && projection.uciMoves ? [projection.initialFen, ...projection.uciMoves].join("\u0000") : null;
            if (key && targeted.has(key) && !retained.has(key)) entry.delete();
            entry.continue();
          };
        }
        const training = tx.objectStore(TRAINING_QUEUE_STORE).openCursor();
        training.onsuccess = () => {
          const entry = training.result;
          if (!entry) return;
          const item = entry.value as TrainingQueueItem;
          const evidence = item.evidence.filter((e) => !removedIds.has(e.gameId));
          if (evidence.length === 0 || scope.kind === "account" && item.playerKey === `account:${scope.id}`) entry.delete();
          else if (evidence.length !== item.evidence.length) {
            const next = { ...item, evidence, status: "queued" as const, updatedAt: new Date().toISOString() };
            delete next.completedAt;
            if (next.version === 2) next.progress = { reviewedPositionCount: 0, totalPositionCount: evidence.length };
            entry.update(next.version === 3 ? normalizeTrainingItem(next) : next);
          }
          entry.continue();
        };
        const jobs = tx.objectStore(HISTORY_ANALYSIS_JOB_STORE).openCursor();
        jobs.onsuccess = () => {
          const entry = jobs.result;
          if (!entry) return;
          const job = entry.value as HistoryAnalysisJobV1;
          const items = job.items.filter((item) => !sourceIds.has(item.gameId) && !(item.analysisId && removedIds.has(item.analysisId)))
            .map((item) => item.status === "running" ? { ...item, status: "queued" as const } : item);
          const excludedItems = job.excludedItems?.filter((item) => !sourceIds.has(item.gameId));
          if (items.length === 0 && !excludedItems?.length) entry.delete();
          else entry.update({ ...job, items, ...(excludedItems ? { excludedItems } : {}), status: job.status === "running" || job.status === "queued" ? "paused" : job.status, updatedAt: new Date().toISOString() });
          entry.continue();
        };
        const runs = tx.objectStore(REVIEW_RUN_STORE).openCursor();
        runs.onsuccess = () => {
          const entry = runs.result;
          if (!entry) return;
          if (removedIds.has(String(entry.primaryKey))) { entry.delete(); entry.continue(); return; }
          if (entry.value.status === "running") entry.update({ ...entry.value, status: "cancelled", updatedAt: new Date().toISOString() });
          entry.continue();
        };
      };
      recordsRequest.onsuccess = gamesRequest.onsuccess = ready;
      const syncs = tx.objectStore(PLATFORM_SYNC_STORE).openCursor();
      syncs.onsuccess = () => {
        const entry = syncs.result;
        if (!entry) return;
        const state = entry.value as PlatformSyncState;
        if (scope.kind === "account" && entry.primaryKey === scope.id) { entry.delete(); entry.continue(); return; }
        if (state.status === "syncing") entry.update({ ...state, status: "paused" });
        entry.continue();
      };

    });
  } finally { db.close(); }
  if (scope.kind === "all" && typeof window !== "undefined") {
    try { window.localStorage.removeItem("open-chess-review-settings-v1"); }
    catch { notifyLocalDataChanged(true); throw new Error("The local library was cleared, but browser preferences could not be cleared. Reload and retry clearing preferences."); }
    window.dispatchEvent(new Event("open-chess-review-settings"));
  }
  notifyLocalDataChanged(true);
  return removedGames;
}

export async function deleteReviewRecord(id: string): Promise<void> { await cleanup({ kind: "review", id }); }
export async function deleteSyncedGamesForAccount(id: string, disconnect = false): Promise<number> { return cleanup({ kind: "account", id, disconnect }); }
export async function clearObjectiveAnalysisCache(): Promise<void> { await cleanup({ kind: "cache" }); }
export type LocalResetScope = "cache" | "all";
export async function resetLocalData(scope: LocalResetScope): Promise<void> { await cleanup({ kind: scope }); }
export { DEFAULT_APP_SETTINGS };
