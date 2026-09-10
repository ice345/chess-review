import { CLASSIFICATION_MULTI_PV } from "@chess-review/analysis";
import { readReviewIdentity } from "./review-identity";
import type { AnalysisCacheProjectionV1, HistoryAnalysisJobV1, SyncedGame } from "@chess-review/shared";
import { gameMoveIdentity, isCompatibleAnalysisProjection, projectionMoveIdentity } from "./analysis-cache";
import type { ReviewRecord } from "./review-library";
import { RUN_LEASE_MS, type ReviewRun } from "./review-runs";

export interface ReviewStatus {
  kind: "saved" | "queued" | "running" | "cancelled" | "failed" | "complete" | "stale" | "position" | "interrupted" | "invalid";
  label: string;
  analyzed: boolean;
  depth?: number;
  cacheKey?: string;
}
export function externalGameKey(external: NonNullable<ReviewRecord["external"]>): string {
  return `${external.provider}:${external.accountId}:${external.externalGameId}`;
}

export function indexReviewProjections(projections: readonly AnalysisCacheProjectionV1[]): Map<string, AnalysisCacheProjectionV1[]> {
  const index = new Map<string, AnalysisCacheProjectionV1[]>();
  for (const projection of projections) {
    const key = projectionMoveIdentity(projection);
    if (key === null) continue;
    const entries = index.get(key) ?? [];
    entries.push(projection);
    index.set(key, entries);
  }
  return index;
}

/** App lifecycle only. Chess truth and compatibility remain package/cache-owned. */
export function resolveReviewStatus(
  record: ReviewRecord,
  projections: readonly AnalysisCacheProjectionV1[] | Map<string, AnalysisCacheProjectionV1[]>,
  source?: SyncedGame,
  run?: ReviewRun,
  jobs: readonly HistoryAnalysisJobV1[] = [],
  now = Date.now(),
): ReviewStatus {
  if (record.kind === "fen") return { kind: "position", label: "Position study", analyzed: false };
  let game;
  try { game = readReviewIdentity(record); }
  catch { return { kind: "invalid", label: "Invalid saved PGN", analyzed: false }; }
  const identity = gameMoveIdentity(game.initialFen, game.uciMoves);
  const candidates = projections instanceof Map ? projections.get(identity) ?? [] : projections.filter((item) => projectionMoveIdentity(item) === identity);
  const current = candidates.filter((item) => item.moveCount === game.uciMoves.length && item.division.totalPlies === game.uciMoves.length
    && isCompatibleAnalysisProjection(item, { initialFen: game.initialFen, uciMoves: game.uciMoves, depth: item.engine.depth, multiPv: CLASSIFICATION_MULTI_PV }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestItem = source ? jobs.flatMap((job) => job.items.filter((item) => item.gameId === source.id).map((item) => ({ item, job })))
    .sort((a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt))[0] : undefined;
  const ownCompletion = run ? run.status === "complete" || run.hadCompletedResult === true
    : source ? source.analyzed || latestItem?.item.status === "completed" || latestItem?.item.status === "cached" : true;
  const analyzed = Boolean(current && ownCompletion);
  const result = { analyzed, ...(analyzed && current ? { depth: current.engine.depth, cacheKey: current.cacheKey } : {}) };
  if (run?.status === "running") {
    const active = now - Date.parse(run.updatedAt) < RUN_LEASE_MS;
    return { ...result, kind: active ? "running" : "interrupted", label: active ? "Analyzing…" : "Interrupted · retry analysis" };
  }
  if (analyzed && current) return { ...result, kind: "complete", label: `Analyzed · depth ${current.engine.depth}` };
  if (run?.status === "cancelled") return { ...result, kind: "cancelled", label: "Cancelled · retry analysis" };
  if (run?.status === "failed") return { ...result, kind: "failed", label: "Analysis failed · retry" };
  if (latestItem?.item.status === "failed") return { ...result, kind: "failed", label: "Analysis failed · retry" };
  if (latestItem?.item.status === "cancelled" || latestItem?.job.status === "cancelled") return { ...result, kind: "cancelled", label: "Analysis cancelled" };
  if (latestItem?.item.status === "running" || latestItem?.item.status === "queued") {
    const active = latestItem.job.status === "running" && now - Date.parse(latestItem.item.updatedAt) < RUN_LEASE_MS;
    return { ...result, kind: active ? "running" : "queued", label: active ? "Analyzing…" : "Queued / paused" };
  }
  if (current && !ownCompletion) return { ...result, kind: "saved", label: "Saved · not analyzed" };
  if (candidates.length || run?.status === "complete" || source?.analyzed) return { ...result, kind: "stale", label: "Analysis needs refreshing" };
  return { ...result, kind: "saved", label: "Saved · not analyzed" };
}
