import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { parsePgn } from "@chess-review/chess-core";
import { CLASSIFICATION_MULTI_PV, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import { STOCKFISH_VERSION } from "@chess-review/stockfish";
import type { GameAnalysisV2, HistoryAnalysisJobV1, SyncedGame, TrainingQueueItemV2 } from "@chess-review/shared";

const PGN = '[White "Ada"]\n[Black "Mikhail"]\n\n1. e4 e5 2. Nf3 *';
const game = parsePgn(PGN);
const stamp = "2026-09-06T00:00:00.000Z";
const side = { phaseAccuracy: {}, qualityCounts: {}, annotationCounts: {} };
const analysis = {
  version: 2, algorithmVersion: OBJECTIVE_ALGORITHM_VERSION, game,
  engine: { stockfishVersion: STOCKFISH_VERSION, depth: 10, multiPv: CLASSIFICATION_MULTI_PV },
  moves: game.plies, division: { totalPlies: game.plies.length },
  white: side, black: side, criticalMoments: [], createdAt: stamp,
} as unknown as GameAnalysisV2;
const synced: SyncedGame = {
  id: "chesscom:game", pgn: PGN, analyzed: false,
  external: { provider: "chesscom", accountId: "account-a", externalGameId: "game", username: "Ada", importedAt: stamp },
  playedAt: stamp, syncedAt: stamp, accountColor: "white", white: { username: "Ada" }, black: { username: "Mikhail" },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) },
    dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  });
});

async function seedConnected() {
  const library = await import("./review-library");
  const platforms = await import("./platform-library");
  const cache = await import("./analysis-cache");
  const record = await library.saveReviewRecord(await library.buildReviewRecordFromSyncedGame(synced));
  await platforms.saveSyncedGames([synced]);
  await cache.putCachedAnalysis(game, { depth: 10, multiPv: CLASSIFICATION_MULTI_PV }, analysis);
  await platforms.markSyncedGameAnalyzed(synced.id, record.id, { algorithmVersion: OBJECTIVE_ALGORITHM_VERSION, depth: 10 });
  return record;
}

describe("local data lifecycle", () => {
  it("does not repair a deliberately deleted external review when Training opens", async () => {
    const record = await seedConnected();
    await (await import("./local-data")).deleteReviewRecord(record.id);
    vi.resetModules(); // a fresh page must still honor the user's deletion
    await (await import("./advanced-study-library")).loadStudyPlayerSummaries();
    expect(await (await import("./review-library")).getReviewRecord(record.id)).toBeNull();
  });

  it("purges an account's review records as well as its imported sources", async () => {
    const record = await seedConnected();
    await (await import("./local-data")).deleteSyncedGamesForAccount("account-a");
    vi.resetModules();
    expect(await (await import("./review-library")).getReviewRecord(record.id)).toBeNull();
    expect(await (await import("./platform-library")).listSyncedGames()).toEqual([]);
  });

  it("includes cached avatars in a full reset", async () => {
    const storage = await import("./browser-storage");
    const db = await storage.openReviewDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storage.PLAYER_AVATAR_STORE, "readwrite");
      tx.objectStore(storage.PLAYER_AVATAR_STORE).put({ key: "avatar" }, "avatar");
      tx.oncomplete = () => resolve();
    });
    await (await import("./local-data")).resetLocalData("all");
    const count = await new Promise<number>((resolve) => {
      const req = db.transaction(storage.PLAYER_AVATAR_STORE).objectStore(storage.PLAYER_AVATAR_STORE).count();
      req.onsuccess = () => resolve(req.result);
    });
    db.close();
    expect(count).toBe(0);
  });
});

async function rawValues(store: string): Promise<unknown[]> {
  const storage = await import("./browser-storage");
  const db = await storage.openReviewDatabase();
  try { return await new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }); } finally { db.close(); }
}

describe("cleanup ownership and stale writers", () => {
  it("removes account learning references and pauses remaining work in the same cleanup", async () => {
    const record = await seedConnected();
    const storage = await import("./browser-storage");
    const other = await (await import("./review-library")).saveReviewRecord(await (await import("./review-library")).buildReviewRecord("pgn", "1. d4 d5 *"));
    const evidence = [record.id, other.id].map((gameId) => ({ gameId, ply: 1, san: "e4", phase: "opening" as const, classification: "mistake" as const, winPercentLoss: 10 }));
    const queue: TrainingQueueItemV2 = {
      version: 2, id: "shared-learning", playerKey: "manual:ada", weaknessKind: "opening-decisions", status: "completed", priority: 1,
      evidence, createdAt: stamp, updatedAt: stamp, completedAt: stamp, sourceReportVersion: "advanced-study-v2",
      progress: { reviewedPositionCount: 2, totalPositionCount: 2 },
    };
    const job: HistoryAnalysisJobV1 = {
      version: 1, id: "mixed-job", status: "running", scope: { providers: [], accountIds: [], timeClasses: [], rated: "all", freshness: "all" },
      objectiveAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION, depth: 10, classificationMultiPv: CLASSIFICATION_MULTI_PV,
      items: [{ gameId: synced.id, analysisId: record.id, status: "completed", attempts: 1, updatedAt: stamp },
        { gameId: "other-source", status: "running", attempts: 1, updatedAt: stamp }],
      createdAt: stamp, updatedAt: stamp,
    };
    const db = await storage.openReviewDatabase();
    await storage.writeLocalData(db, storage.DATA_STORES, (tx) => {
      tx.objectStore(storage.TRAINING_QUEUE_STORE).put(queue, queue.id);
      tx.objectStore(storage.TRAINING_QUEUE_STORE).put({ ...queue, id: "account-learning", playerKey: "account:account-a" }, "account-learning");
      tx.objectStore(storage.HISTORY_ANALYSIS_JOB_STORE).put(job, job.id);
      tx.objectStore(storage.PLATFORM_ACCOUNT_STORE).put({ id: "account-a" }, "account-a");
      tx.objectStore(storage.PLATFORM_ACCOUNT_STORE).put({ id: "account-b" }, "account-b");
      for (const id of ["account-a", "account-b"]) tx.objectStore(storage.PLATFORM_SYNC_STORE).put({ accountId: id, status: "syncing" }, id);
      for (const id of [record.id, other.id]) tx.objectStore(storage.REVIEW_RUN_STORE).put({ reviewId: id, status: "running" }, id);
    });
    db.close();
    await (await import("./local-data")).deleteSyncedGamesForAccount("account-a", true);
    vi.resetModules();
    expect(await rawValues(storage.PLATFORM_ACCOUNT_STORE)).toEqual([{ id: "account-b" }]);
    expect(await rawValues(storage.PLATFORM_SYNC_STORE)).toEqual([{ accountId: "account-b", status: "paused" }]);
    expect(await rawValues(storage.REVIEW_RUN_STORE)).toMatchObject([{ reviewId: other.id, status: "cancelled" }]);
    const remainingQueue = await rawValues(storage.TRAINING_QUEUE_STORE) as TrainingQueueItemV2[];
    expect(remainingQueue).toHaveLength(1);
    expect(remainingQueue[0]).toMatchObject({ status: "queued", evidence: [evidence[1]], progress: { reviewedPositionCount: 0, totalPositionCount: 1 } });
    expect(remainingQueue[0]?.completedAt).toBeUndefined();
    expect(await rawValues(storage.HISTORY_ANALYSIS_JOB_STORE)).toMatchObject([{ status: "paused", items: [{ gameId: "other-source", status: "queued" }] }]);
  });

  it("preserves shared analysis and an unrelated manual import during account purge", async () => {
    await seedConnected();
    const library = await import("./review-library");
    const manual = await library.saveReviewRecord(await library.buildReviewRecord("pgn", PGN));
    await (await import("./local-data")).deleteSyncedGamesForAccount("account-a");
    vi.resetModules();
    expect(await (await import("./review-library")).getReviewRecord(manual.id)).not.toBeNull();
    expect(await rawValues("objective-analyses")).toHaveLength(1);
    expect(await rawValues("objective-analysis-index")).toHaveLength(1);
  });

  it("removes unreferenced analysis payloads on account purge", async () => {
    await seedConnected();
    await (await import("./local-data")).deleteSyncedGamesForAccount("account-a");
    vi.resetModules();
    expect(await rawValues("objective-analyses")).toEqual([]);
    expect(await rawValues("objective-analysis-index")).toEqual([]);
  });

  it("clears cache without deleting source records and resets stale analyzed markers", async () => {
    const record = await seedConnected();
    await (await import("./local-data")).resetLocalData("cache");
    vi.resetModules();
    expect(await (await import("./review-library")).getReviewRecord(record.id)).not.toBeNull();
    expect(await rawValues("objective-analyses")).toEqual([]);
    expect(await rawValues("synced-games")).toMatchObject([{ analyzed: false }]);
    expect((await (await import("./library-snapshot")).loadLibrarySnapshot()).statuses.get(record.id)?.analyzed).toBe(false);
  });

  it("rejects delayed writes from a held connection and a second page after reset", async () => {
    await seedConnected();
    const oldStorage = await import("./browser-storage");
    const oldLibrary = await import("./review-library");
    const db = await oldStorage.openReviewDatabase();
    vi.resetModules(); // a second browser page owns the cleanup
    await (await import("./local-data")).resetLocalData("all");
    await expect(oldStorage.writeLocalData(db, oldStorage.REVIEW_STORE, (tx) => {
      tx.objectStore(oldStorage.REVIEW_STORE).put({ id: "zombie" }, "zombie");
    })).rejects.toThrow("Reload");
    await expect(oldLibrary.saveReviewRecord(await oldLibrary.buildReviewRecord("pgn", PGN))).rejects.toThrow("Reload");
    db.close();
    vi.resetModules();
    expect(await rawValues("review-records")).toEqual([]);
  });

  it("permits deliberate re-import, while background repair cannot restore a deletion", async () => {
    const record = await seedConnected();
    await (await import("./local-data")).deleteReviewRecord(record.id);
    vi.resetModules();
    const library = await import("./review-library");
    await expect(library.saveReviewRecord(record)).rejects.toThrow("deleted");
    await library.saveReviewRecord(record, { restoreDeleted: true });
    expect(await library.isReviewDeleted(record)).toBe(false);
    expect(await library.getReviewRecord(record.id)).not.toBeNull();
  });

  it("rolls back every store when a guarded multi-store write fails", async () => {
    const storage = await import("./browser-storage");
    const db = await storage.openReviewDatabase();
    await expect(storage.writeLocalData(db, [storage.REVIEW_STORE, storage.SYNCED_GAME_STORE], (tx, fail) => {
      tx.objectStore(storage.REVIEW_STORE).put({ id: "partial" }, "partial");
      tx.objectStore(storage.SYNCED_GAME_STORE).put({ id: "partial" }, "partial");
      fail(new Error("Storage unavailable"));
    })).rejects.toThrow("Storage unavailable");
    db.close();
    expect(await rawValues(storage.REVIEW_STORE)).toEqual([]);
    expect(await rawValues(storage.SYNCED_GAME_STORE)).toEqual([]);
  });
});

describe("stored results and run lifecycle", () => {
  it("upgrades a v6 database while preserving existing games", async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("open-chess-review", 6);
      request.onupgradeneeded = () => request.result.createObjectStore("review-records").put({ id: "legacy" }, "legacy");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    expect(await rawValues("review-records")).toEqual([{ id: "legacy" }]);
    expect(await rawValues("review-runs")).toEqual([]);
  });

  it("ignores an orphaned cache projection instead of counting it as analyzed", async () => {
    const record = await seedConnected();
    const storage = await import("./browser-storage");
    const db = await storage.openReviewDatabase();
    await storage.writeLocalData(db, storage.ANALYSIS_STORE, (tx) => tx.objectStore(storage.ANALYSIS_STORE).clear());
    db.close();
    expect(await (await import("./analysis-cache")).listAnalysisCacheProjections()).toEqual([]);
    expect((await (await import("./library-snapshot")).loadLibrarySnapshot()).statuses.get(record.id)?.analyzed).toBe(false);
  });

  it("does not restore a partial result even when it has the exact cache key", async () => {
    await seedConnected();
    const cache = await import("./analysis-cache");
    await cache.putCachedAnalysis(game, { depth: 10, multiPv: CLASSIFICATION_MULTI_PV }, { ...analysis, moves: analysis.moves.slice(0, 1) });
    expect(await cache.getCachedAnalysis(game, { depth: 10, multiPv: CLASSIFICATION_MULTI_PV })).toBeNull();
  });

  it("does not let late heartbeats overwrite completion or a newer run", async () => {
    const record = await seedConnected();
    const runs = await import("./review-runs");
    const run = { version: 1 as const, reviewId: record.id, runId: "first", status: "running" as const, depth: 10, updatedAt: stamp };
    await runs.saveReviewRun(run, true);
    await runs.saveReviewRun({ ...run, status: "complete" });
    await runs.saveReviewRun(run);
    expect(await runs.listReviewRuns()).toMatchObject([{ status: "complete" }]);
    await runs.saveReviewRun({ ...run, runId: "second" }, true);
    await runs.saveReviewRun({ ...run, status: "failed" });
    expect(await runs.listReviewRuns()).toMatchObject([{ runId: "second", status: "running", hadCompletedResult: true }]);
    await runs.recordRestoredAnalysis(record.id, 10);
    expect(await runs.listReviewRuns()).toMatchObject([{ runId: "second", status: "running", hadCompletedResult: true }]);
  });

  it("persists a failed run and propagates quota errors without marking completion", async () => {
    const record = await seedConnected();
    const runs = await import("./review-runs");
    await expect(runs.withReviewRun(record.id, 10, async () => { throw new DOMException("Storage is full", "QuotaExceededError"); })).rejects.toThrow("Storage is full");
    expect(await runs.listReviewRuns()).toMatchObject([{ status: "failed" }]);
  });
});
