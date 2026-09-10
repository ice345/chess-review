import { writeLocalData, notifyLocalDataChanged } from "./browser-storage";
import { COACH_PROMPT_VERSION, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { AnalysisCacheProjectionV1, GameAnalysisV2 } from "@chess-review/shared";
import { STOCKFISH_VERSION } from "@chess-review/stockfish";
import { ANALYSIS_INDEX_STORE, ANALYSIS_STORE, openReviewDatabase } from "./browser-storage";

export interface AnalysisCacheOptions {
  depth: number;
  multiPv: number;
}

export interface CompatibleAnalysisQuery {
  initialFen: string;
  uciMoves: readonly string[];
  depth: number;
  multiPv: number;
  algorithmVersion?: string;
  stockfishVersion?: string;
}

/** Header-independent game identity. PGN string hashing is not this identity. */
export function gameMoveIdentity(initialFen: string, uciMoves: readonly string[]): string {
  return [initialFen, ...uciMoves].join("\u0000");
}

export function projectionMoveIdentity(projection: Pick<AnalysisCacheProjectionV1, "initialFen" | "uciMoves">): string | null {
  if (projection.initialFen === undefined || projection.uciMoves === undefined) return null;
  return gameMoveIdentity(projection.initialFen, projection.uciMoves);
}

export function compatibleAnalysisQuery(
  game: Pick<NormalizedGame, "initialFen" | "plies">,
  options: AnalysisCacheOptions,
): CompatibleAnalysisQuery {
  return {
    initialFen: game.initialFen,
    uciMoves: game.plies.map((ply) => ply.uci),
    depth: options.depth,
    multiPv: options.multiPv,
  };
}

export function isCompatibleAnalysisProjection(
  projection: Pick<AnalysisCacheProjectionV1, "version" | "algorithmVersion" | "engine" | "initialFen" | "uciMoves">,
  query: CompatibleAnalysisQuery,
): boolean {
  if (projection.version !== 1) return false;
  if (projection.algorithmVersion !== (query.algorithmVersion ?? OBJECTIVE_ALGORITHM_VERSION)) return false;
  if (projection.engine.stockfishVersion !== (query.stockfishVersion ?? STOCKFISH_VERSION)) return false;
  if (projection.engine.depth !== query.depth) return false;
  const multiPv = projection.engine.classificationMultiPv ?? projection.engine.multiPv;
  if (multiPv !== query.multiPv) return false;
  const identity = projectionMoveIdentity(projection);
  return identity !== null && identity === gameMoveIdentity(query.initialFen, query.uciMoves);
}

/** Latest compatible projection for the same chess game and analysis settings. */
export function selectCompatibleAnalysisProjection(
  projections: readonly AnalysisCacheProjectionV1[],
  query: CompatibleAnalysisQuery,
): AnalysisCacheProjectionV1 | null {
  let latest: AnalysisCacheProjectionV1 | null = null;
  for (const projection of projections) {
    if (!isCompatibleAnalysisProjection(projection, query)) continue;
    if (!latest || projection.createdAt.localeCompare(latest.createdAt) > 0) latest = projection;
  }
  return latest;
}

async function gameFingerprint(initialFen: string, pgn: string): Promise<string> {
  const identity = `${initialFen}\u0000${pgn}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function withoutStaleCoach(analysis: GameAnalysisV2): GameAnalysisV2 {
  const moves = analysis.moves.map((move) => {
    if (!move.coach || move.coach.source.promptVersion === COACH_PROMPT_VERSION) return move;
    const canonicalMove = { ...move };
    delete canonicalMove.coach;
    return canonicalMove;
  });
  if (!analysis.coachSummary || analysis.coachSummary.source.promptVersion === COACH_PROMPT_VERSION) {
    return { ...analysis, moves };
  }
  const canonicalAnalysis = { ...analysis };
  delete canonicalAnalysis.coachSummary;
  return { ...canonicalAnalysis, moves };
}

export async function analysisGameFingerprint(game: NormalizedGame): Promise<string> {
  return gameFingerprint(game.initialFen, game.pgn);
}

export async function analysisCacheKey(game: NormalizedGame, options: AnalysisCacheOptions): Promise<string> {
  const identity = [
    OBJECTIVE_ALGORITHM_VERSION,
    STOCKFISH_VERSION,
    options.depth,
    options.multiPv,
    game.initialFen,
    game.pgn,
  ].join("\u0000");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildAnalysisCacheProjection(
  analysis: GameAnalysisV2,
  key: string,
  gameFingerprint: string,
): AnalysisCacheProjectionV1 {
  const approximateBytes = new TextEncoder().encode(JSON.stringify(analysis)).byteLength;
  return {
    version: 1,
    cacheKey: key,
    gameFingerprint,
    algorithmVersion: analysis.algorithmVersion,
    objectiveVersion: 2,
    createdAt: analysis.createdAt,
    engine: analysis.engine,
    headers: analysis.game.headers,
    // Header-independent identity keeps library joins and Review restores stable.
    initialFen: analysis.game.initialFen,
    uciMoves: analysis.moves.map((move) => move.uci),
    ...(analysis.opening === undefined ? {} : { opening: analysis.opening }),
    division: analysis.division,
    white: {
      ...(analysis.white.accuracy === undefined ? {} : { accuracy: analysis.white.accuracy }),
      phaseAccuracy: analysis.white.phaseAccuracy,
      qualityCounts: analysis.white.qualityCounts,
      annotationCounts: analysis.white.annotationCounts,
    },
    black: {
      ...(analysis.black.accuracy === undefined ? {} : { accuracy: analysis.black.accuracy }),
      phaseAccuracy: analysis.black.phaseAccuracy,
      qualityCounts: analysis.black.qualityCounts,
      annotationCounts: analysis.black.annotationCounts,
    },
    moveCount: analysis.moves.length,
    criticalMomentCount: analysis.criticalMoments.length,
    approximateBytes,
  };
}

async function readCachedAnalysis(key: string, requireCurrentAlgorithm: boolean): Promise<GameAnalysisV2 | null> {
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).get(key);
      request.onsuccess = () => {
        const cached = request.result as GameAnalysisV2 | undefined;
        if (!cached || cached.version !== 2) {
          resolve(null);
          return;
        }
        if (requireCurrentAlgorithm && cached.algorithmVersion !== OBJECTIVE_ALGORITHM_VERSION) {
          resolve(null);
          return;
        }
        resolve(withoutStaleCoach(cached));
      };
      request.onerror = () => reject(request.error ?? new Error("Unable to read the analysis cache."));
    });
  } finally {
    database.close();
  }
}

/**
 * Resolve canonical objective analysis for a game.
 * Concrete cache keys still include the raw PGN string, but Review/Training
 * must not treat that string as game identity. Lookup order:
 * 1. exact cache key for the current normalized game
 * 2. compatible projection by initial FEN + played UCI + engine settings
 */
export async function getCachedAnalysis(
  game: NormalizedGame,
  options: AnalysisCacheOptions,
): Promise<GameAnalysisV2 | null> {
  const key = await analysisCacheKey(game, options);
  const query = compatibleAnalysisQuery(game, options);
  const valid = (cached: GameAnalysisV2 | null): cached is GameAnalysisV2 => Boolean(cached
    && cached.moves.length === game.plies.length && cached.division.totalPlies === game.plies.length
    && isCompatibleAnalysisProjection({ version: 1, algorithmVersion: cached.algorithmVersion,
      engine: cached.engine, initialFen: cached.game.initialFen, uciMoves: cached.moves.map((move) => move.uci) }, query));
  const exact = await readCachedAnalysis(key, false);
  if (valid(exact)) return exact;
  const matched = selectCompatibleAnalysisProjection(
    await listAnalysisCacheProjections(),
    compatibleAnalysisQuery(game, options),
  );
  if (!matched || matched.cacheKey === key) return null;
  const cached = await readCachedAnalysis(matched.cacheKey, true);
  return valid(cached) ? cached : null;
}

export async function putCachedAnalysis(
  game: NormalizedGame,
  options: AnalysisCacheOptions,
  analysis: GameAnalysisV2,
): Promise<void> {
  const database = await openReviewDatabase();
  try {
    const [key, fingerprint] = await Promise.all([
      analysisCacheKey(game, options),
      analysisGameFingerprint(game),
    ]);
    await writeLocalData(database, [ANALYSIS_STORE, ANALYSIS_INDEX_STORE], (transaction) => {
      transaction.objectStore(ANALYSIS_STORE).put(analysis, key);
      transaction.objectStore(ANALYSIS_INDEX_STORE).put(buildAnalysisCacheProjection(analysis, key, fingerprint), key);
    });
    notifyLocalDataChanged();
  } finally {
    database.close();
  }
}

export async function listAnalysisCacheProjections(includeStale = false): Promise<AnalysisCacheProjectionV1[]> {
  await backfillAnalysisCacheProjections();
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction([ANALYSIS_INDEX_STORE, ANALYSIS_STORE], "readonly");
      const index = tx.objectStore(ANALYSIS_INDEX_STORE).getAll();
      const keys = tx.objectStore(ANALYSIS_STORE).getAllKeys();
      tx.oncomplete = () => {
        const available = new Set(keys.result.map(String));
        resolve((index.result as AnalysisCacheProjectionV1[])
          .filter((item) => available.has(item.cacheKey) && item.version === 1 && (includeStale || item.algorithmVersion === OBJECTIVE_ALGORITHM_VERSION))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      };
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Unable to list the analysis index."));
    });
  } finally {
    database.close();
  }
}

/**
 * Upgrades pre-index V2 cache entries and pre-identity projections one record
 * at a time. Only keys are held as a collection; full canonical payloads are
 * never materialized together. Projections written before `uciMoves` existed
 * are regenerated so header-independent library joins cover old caches too.
 */
export async function backfillAnalysisCacheProjections(): Promise<number> {
  const database = await openReviewDatabase();
  try {
    const [analysisKeys, projectionKeys] = await Promise.all([
      new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Unable to inspect analysis cache keys."));
      }),
      new Promise<AnalysisCacheProjectionV1[]>((resolve, reject) => {
        const request = database.transaction(ANALYSIS_INDEX_STORE, "readonly").objectStore(ANALYSIS_INDEX_STORE).getAll();
        request.onsuccess = () => resolve(request.result as AnalysisCacheProjectionV1[]);
        request.onerror = () => reject(request.error ?? new Error("Unable to inspect analysis index keys."));
      }),
    ]);
    const indexed = new Map(projectionKeys.map((item) => [String(item.cacheKey), item]));
    let added = 0;
    for (const rawKey of analysisKeys) {
      const key = String(rawKey);
      const existing = indexed.get(key);
      if (existing !== undefined && existing.uciMoves !== undefined) continue;
      const analysis = await new Promise<GameAnalysisV2 | null>((resolve, reject) => {
        const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).get(rawKey);
        request.onsuccess = () => resolve((request.result as GameAnalysisV2 | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("Unable to read an analysis for indexing."));
      });
      if (!analysis || analysis.version !== 2 || analysis.algorithmVersion !== OBJECTIVE_ALGORITHM_VERSION || !analysis.game.pgn) continue;
      const fingerprint = await gameFingerprint(analysis.game.initialFen, analysis.game.pgn);
      await writeLocalData(database, ANALYSIS_INDEX_STORE, (transaction) => {
        transaction.objectStore(ANALYSIS_INDEX_STORE).put(buildAnalysisCacheProjection(analysis, key, fingerprint), rawKey);
      });
      notifyLocalDataChanged();
      added += 1;
    }
    return added;
  } finally {
    database.close();
  }
}

export async function getCachedAnalysisByKey(key: string): Promise<GameAnalysisV2 | null> {
  return readCachedAnalysis(key, true);
}

export async function listCachedAnalyses(): Promise<GameAnalysisV2[]> {
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).getAll();
      request.onsuccess = () => resolve((request.result as GameAnalysisV2[])
        .filter((analysis) => analysis.version === 2)
        .map(withoutStaleCoach));
      request.onerror = () => reject(request.error ?? new Error("Unable to list the analysis cache."));
    });
  } finally {
    database.close();
  }
}
