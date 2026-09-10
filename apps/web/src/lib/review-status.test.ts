import { describe, expect, it } from "vitest";
import { parsePgn } from "@chess-review/chess-core";
import { CLASSIFICATION_MULTI_PV, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import { STOCKFISH_VERSION } from "@chess-review/stockfish";
import type { AnalysisCacheProjectionV1, SyncedGame } from "@chess-review/shared";
import { buildReviewRecord } from "./review-library";
import { resolveReviewStatus } from "./review-status";
import type { ReviewRun } from "./review-runs";

const PGN = '1. e4 e5 2. Nf3 *';
const game = parsePgn(PGN);
const now = Date.parse("2026-09-06T01:00:00Z");
function projection(overrides: Partial<AnalysisCacheProjectionV1> = {}): AnalysisCacheProjectionV1 {
  return { version: 1, objectiveVersion: 2, algorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    cacheKey: "cache", gameFingerprint: "fingerprint", createdAt: new Date(now).toISOString(),
    engine: { stockfishVersion: STOCKFISH_VERSION, depth: 10, multiPv: CLASSIFICATION_MULTI_PV },
    initialFen: game.initialFen, uciMoves: game.plies.map((ply) => ply.uci), moveCount: 3,
    division: { totalPlies: 3 }, ...overrides,
  } as AnalysisCacheProjectionV1;
}
const record = await buildReviewRecord("pgn", PGN);
const run: ReviewRun = { version: 1, reviewId: record.id, runId: "attempt", depth: 10, status: "running", updatedAt: new Date(now).toISOString() };

describe("truthful review lifecycle", () => {
  it("keeps imported PGN pending until completed analysis exists", () => {
    expect(resolveReviewStatus(record, []).kind).toBe("saved");
    expect(resolveReviewStatus(record, []).analyzed).toBe(false);
  });
  it("restores compatible legacy analysis without depending on today's depth preference", () => {
    expect(resolveReviewStatus(record, [projection()])).toMatchObject({ analyzed: true, depth: 10, kind: "complete" });
  });
  it("keeps FEN studies outside completed-game counts", async () => {
    expect(resolveReviewStatus(await buildReviewRecord("fen", game.initialFen), [projection()])).toMatchObject({ kind: "position", analyzed: false });
  });
  it.each(["cancelled", "failed"] as const)("does not turn a %s attempt into success through another record's shared cache", (status) => {
    expect(resolveReviewStatus(record, [projection()], undefined, { ...run, status }).analyzed).toBe(false);
  });
  it("retains a previous completed result when a later retry fails", () => {
    expect(resolveReviewStatus(record, [projection()], undefined, { ...run, status: "failed", hadCompletedResult: true }).analyzed).toBe(true);
  });
  it("shows current work and expires abandoned progress", () => {
    expect(resolveReviewStatus(record, [], undefined, run, [], now).kind).toBe("running");
    expect(resolveReviewStatus(record, [], undefined, run, [], now + 60_000).kind).toBe("interrupted");
  });
  it("rejects incomplete, stale, or incompatible projections", () => {
    for (const cache of [projection({ moveCount: 2 }), projection({ algorithmVersion: "old" }), projection({ engine: { ...projection().engine, stockfishVersion: "old" } }), projection({ engine: { ...projection().engine, multiPv: 1 } })]) {
      expect(resolveReviewStatus(record, [cache]).analyzed).toBe(false);
    }
  });
  it("requires available cache even when the durable run says completed", () => {
    expect(resolveReviewStatus(record, [], undefined, { ...run, status: "complete" }).analyzed).toBe(false);
  });
  it("does not promote an unfinished synced game merely because it shares a PGN", () => {
    expect(resolveReviewStatus(record, [projection()], { id: "source", analyzed: false } as SyncedGame).analyzed).toBe(false);
  });
});
