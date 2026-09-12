import { describe, expect, it } from "vitest";
import type { HistoryAnalysisJobV1, HistoryAnalysisScopeV1, SyncedGame } from "@chess-review/shared";
import { OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import {
  cancelHistoryAnalysisJobRecord,
  gameMatchesHistoryScope,
  isHistoryAnalysisJobFinished,
  markHistoryJobSuperseded,
  pauseHistoryAnalysisJobRecord,
  partitionUnparsableSyncedGames,
  planHistoryJobSupersession,
  retryFailedHistoryAnalysisJobRecord,
  runBoundedParallel,
  selectHistoryAnalysisGames,
  shouldSupersedeHistoryJob,
} from "./history-analysis-jobs";

function game(
  id: string,
  overrides: Partial<SyncedGame> = {},
): SyncedGame {
  const provider = id.startsWith("li") ? "lichess" : "chesscom";
  return {
    id,
    external: { provider, externalGameId: id, accountId: `${provider}:ada`, username: "Ada", importedAt: "2026-08-01T00:00:00.000Z" },
    pgn: `pgn-${id}`,
    playedAt: "2026-08-10T00:00:00.000Z",
    timeClass: "rapid",
    rated: true,
    white: { username: "Ada", result: "win" },
    black: { username: "Mikhail", result: "loss" },
    accountColor: "white",
    analyzed: false,
    syncedAt: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

const SCOPE: HistoryAnalysisScopeV1 = {
  providers: [],
  accountIds: [],
  timeClasses: [],
  rated: "all",
  freshness: "all",
};

describe("history analysis scope", () => {
  it("applies provider, account, date, time-control and rated filters together", () => {
    const scope: HistoryAnalysisScopeV1 = {
      providers: ["chesscom"],
      accountIds: ["chesscom:ada"],
      dateFrom: "2026-08-01T00:00:00.000Z",
      dateTo: "2026-08-31T23:59:59.999Z",
      timeClasses: ["rapid"],
      rated: "rated",
      freshness: "all",
    };
    expect(gameMatchesHistoryScope(game("cc-1"), scope, 12)).toBe(true);
    expect(gameMatchesHistoryScope(game("li-1"), scope, 12)).toBe(false);
    expect(gameMatchesHistoryScope(game("cc-2", { rated: false }), scope, 12)).toBe(false);
    expect(gameMatchesHistoryScope(game("cc-3", { playedAt: "2026-09-01T00:00:00.000Z" }), scope, 12)).toBe(false);
  });

  it("defines stale against the current objective identity and requested depth", () => {
    const stale = { ...SCOPE, freshness: "stale" as const };
    expect(gameMatchesHistoryScope(game("cc-new"), stale, 12)).toBe(false);
    expect(gameMatchesHistoryScope(game("cc-old", { analyzed: true, analysisAlgorithmVersion: "old", analysisDepth: 12 }), stale, 12)).toBe(true);
    expect(gameMatchesHistoryScope(game("cc-shallow", { analyzed: true, analysisAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION, analysisDepth: 10 }), stale, 12)).toBe(true);
    expect(gameMatchesHistoryScope(game("cc-current", { analyzed: true, analysisAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION, analysisDepth: 12 }), stale, 12)).toBe(false);
  });

  it("deduplicates provider IDs and identical PGNs in deterministic date order", () => {
    const duplicatePgn = game("cc-copy", { pgn: "pgn-cc-1", playedAt: "2026-08-11T00:00:00.000Z" });
    const selected = selectHistoryAnalysisGames([
      game("cc-2", { playedAt: "2026-08-12T00:00:00.000Z" }),
      duplicatePgn,
      game("cc-1", { playedAt: "2026-08-10T00:00:00.000Z" }),
      game("cc-1", { playedAt: "2026-08-10T00:00:00.000Z" }),
    ], SCOPE, 12);
    expect(selected.map(({ id }) => id)).toEqual(["cc-1", "cc-2"]);
  });

  it("keeps unparsable provider PGNs out of the retryable queue with a reason", () => {
    const validGame = game("cc-ok", { pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 * " });
    const invalidGame = game("cc-bad", { pgn: "pgn-cc-bad" });
    const { valid, excluded } = partitionUnparsableSyncedGames([invalidGame, validGame]);

    expect(valid.map(({ id }) => id)).toEqual(["cc-ok"]);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({ gameId: "cc-bad", reason: expect.any(String) });
  });

  it("keeps every valid game through partitioning unchanged", () => {
    const source = [game("cc-a", { pgn: "1. d4 d5 *" }), game("cc-b", { pgn: "1. c4 e5 *" })];
    expect(partitionUnparsableSyncedGames(source)).toMatchObject({ valid: source, excluded: [] });
  });
});

describe("history analysis durable transitions", () => {
  const job: HistoryAnalysisJobV1 = {
    version: 1,
    id: "job",
    status: "running",
    scope: SCOPE,
    objectiveAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    depth: 12,
    classificationMultiPv: 3,
    items: [
      { gameId: "done", status: "completed", attempts: 1, updatedAt: "before" },
      { gameId: "active", status: "running", attempts: 1, updatedAt: "before" },
      { gameId: "failed", status: "failed", attempts: 2, error: "boom", updatedAt: "before" },
      { gameId: "waiting", status: "queued", attempts: 0, updatedAt: "before" },
    ],
    createdAt: "before",
    updatedAt: "before",
  };

  it("returns an interrupted active item to the resumable queue", () => {
    const paused = pauseHistoryAnalysisJobRecord(job, "paused-at");
    expect(paused.status).toBe("paused");
    expect(paused.items.map(({ status }) => status)).toEqual(["completed", "queued", "failed", "queued"]);
    expect(paused.items[1]?.attempts).toBe(1);
  });

  it("cancels only unfinished items and preserves completed evidence", () => {
    const cancelled = cancelHistoryAnalysisJobRecord(job, "cancelled-at");
    expect(cancelled.items.map(({ status }) => status)).toEqual(["completed", "cancelled", "failed", "cancelled"]);
    expect(cancelled.completedAt).toBe("cancelled-at");
  });

  it("requeues only failures without erasing attempt history", () => {
    const retried = retryFailedHistoryAnalysisJobRecord({ ...job, status: "failed", completedAt: "before", error: "partial" }, "retry-at");
    expect(retried.status).toBe("queued");
    expect(retried.items[2]).toMatchObject({ status: "queued", attempts: 2, updatedAt: "retry-at" });
    expect(retried.items[2]?.error).toBeUndefined();
    expect(retried.completedAt).toBeUndefined();
  });

  it("migrates unparsable failed games out of retryable items and failure accounting", () => {
    const withInvalid = { ...job };
    withInvalid.items = [
      ...job.items,
      { gameId: "cc-broken", status: "failed" as const, attempts: 3, error: "Invalid FEN: missing black king", updatedAt: "before" },
    ];
    const retried = retryFailedHistoryAnalysisJobRecord(withInvalid, "retry-at", ["cc-broken"]);

    expect(retried.items.find((item) => item.gameId === "cc-broken")).toBeUndefined();
    expect(retried.excludedItems).toEqual([
      { gameId: "cc-broken", reason: "Invalid FEN: missing black king" },
    ]);
    expect(retried.items.find((item) => item.gameId === "failed")?.status).toBe("queued");
    expect(retried.status).toBe("queued");
  });

  it("completes a job whose only remaining failures were unparsable provider games", () => {
    const onlyInvalid: HistoryAnalysisJobV1 = {
      ...job,
      status: "failed",
      items: [
        { gameId: "done", status: "completed", attempts: 1, updatedAt: "before" },
        { gameId: "cc-broken", status: "failed", attempts: 3, error: "Invalid FEN: missing black king", updatedAt: "before" },
      ],
    };
    const retried = retryFailedHistoryAnalysisJobRecord(onlyInvalid, "retry-at", ["cc-broken"]);
    expect(retried.status).toBe("completed");
    expect(retried.items.map((item) => item.gameId)).toEqual(["done"]);
    expect(retried.excludedItems).toHaveLength(1);
    expect(retried.items.some((item) => item.status === "failed")).toBe(false);
  });

  it("only treats terminal runs as removable history", () => {
    expect(isHistoryAnalysisJobFinished({ status: "completed" })).toBe(true);
    expect(isHistoryAnalysisJobFinished({ status: "failed" })).toBe(true);
    expect(isHistoryAnalysisJobFinished({ status: "cancelled" })).toBe(true);
    expect(isHistoryAnalysisJobFinished({ status: "queued" })).toBe(false);
    expect(isHistoryAnalysisJobFinished({ status: "running" })).toBe(false);
    expect(isHistoryAnalysisJobFinished({ status: "paused" })).toBe(false);
  });
});

describe("history analysis parallel runner", () => {
  it("keeps concurrent work bounded while completing every item", async () => {
    let active = 0;
    let maximum = 0;
    const completed: number[] = [];
    await runBoundedParallel([0, 1, 2, 3, 4], 2, async (item) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, item === 0 ? 8 : 1));
      completed.push(item);
      active -= 1;
    });
    expect(maximum).toBe(2);
    expect(completed.sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4]);
  });

  it("does not create workers for an empty queue", async () => {
    let called = false;
    await runBoundedParallel([], 2, async () => { called = true; });
    expect(called).toBe(false);
  });
});

describe("history job supersession", () => {
  function analysisJob(
    id: string,
    status: HistoryAnalysisJobV1["status"],
    gameIds: string[],
    createdAt: string,
    extras: Partial<HistoryAnalysisJobV1> = {},
  ): HistoryAnalysisJobV1 {
    return {
      version: 1,
      id,
      status,
      scope: SCOPE,
      objectiveAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
      depth: 10,
      classificationMultiPv: 3,
      items: gameIds.map((gameId) => ({ gameId, status: status === "paused" ? "queued" : "completed", attempts: 1, updatedAt: createdAt })),
      createdAt,
      updatedAt: createdAt,
      ...extras,
    };
  }

  it("replaces a paused smaller job when a later compatible job covers the same games", () => {
    const paused = analysisJob("small", "paused", ["g1", "g2", "g3", "g4", "g5"], "2026-08-01T00:00:00.000Z");
    const later = analysisJob("large", "failed", Array.from({ length: 98 }, (_, index) => `g${index + 1}`), "2026-08-02T00:00:00.000Z");
    later.items = later.items.map((item, index) => ({
      ...item,
      status: index < 95 ? "completed" : "failed",
    }));

    expect(shouldSupersedeHistoryJob(later, paused)).toBe(true);
    expect(planHistoryJobSupersession([later, paused])).toEqual([{ older: paused, newer: later }]);
    expect(markHistoryJobSuperseded(paused, later.id, "now")).toMatchObject({
      status: "cancelled",
      supersededBy: "large",
    });
  });

  it("does not replace genuinely different scopes or an active running job", () => {
    const paused = analysisJob("small", "paused", ["g1", "g2"], "2026-08-01T00:00:00.000Z");
    const running = analysisJob("run", "running", ["g1", "g2"], "2026-08-01T00:00:00.000Z");
    const otherAccount = analysisJob("other", "completed", ["g1", "g2", "g3"], "2026-08-03T00:00:00.000Z", {
      scope: { ...SCOPE, accountIds: ["chesscom:bob"] },
    });

    expect(shouldSupersedeHistoryJob(otherAccount, paused)).toBe(false);
    expect(shouldSupersedeHistoryJob(paused, running)).toBe(false);
    expect(planHistoryJobSupersession([paused, running, otherAccount])).toEqual([]);
  });
});
