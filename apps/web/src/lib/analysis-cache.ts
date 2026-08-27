import { COACH_PROMPT_VERSION, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { AnalysisCacheProjectionV1, GameAnalysisV2 } from "@chess-review/shared";
import { STOCKFISH_VERSION } from "@chess-review/stockfish";
import { ANALYSIS_INDEX_STORE, ANALYSIS_STORE, openReviewDatabase } from "./browser-storage";

export interface AnalysisCacheOptions {
  depth: number;
  multiPv: number;
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

function projection(
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
    // Header-independent identity keeps library joins stable across builds.
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

export async function getCachedAnalysis(
  game: NormalizedGame,
  options: AnalysisCacheOptions,
): Promise<GameAnalysisV2 | null> {
  const database = await openReviewDatabase();
  try {
    const key = await analysisCacheKey(game, options);
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).get(key);
      request.onsuccess = () => {
        const cached = request.result as GameAnalysisV2 | undefined;
        resolve(cached?.version === 2 ? withoutStaleCoach(cached) : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Unable to read the analysis cache."));
    });
  } finally {
    database.close();
  }
}

export async function putCachedAnalysis(
  game: NormalizedGame,
  options: AnalysisCacheOptions,
  analysis: GameAnalysisV2,
): Promise<void> {
  const database = await openReviewDatabase();
  try {
    const [key, gameFingerprint] = await Promise.all([
      analysisCacheKey(game, options),
      analysisGameFingerprint(game),
    ]);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([ANALYSIS_STORE, ANALYSIS_INDEX_STORE], "readwrite");
      transaction.objectStore(ANALYSIS_STORE).put(analysis, key);
      transaction.objectStore(ANALYSIS_INDEX_STORE).put(projection(analysis, key, gameFingerprint), key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write the analysis cache."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Analysis cache write was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function listAnalysisCacheProjections(): Promise<AnalysisCacheProjectionV1[]> {
  await backfillAnalysisCacheProjections();
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ANALYSIS_INDEX_STORE, "readonly").objectStore(ANALYSIS_INDEX_STORE).getAll();
      request.onsuccess = () => resolve((request.result as AnalysisCacheProjectionV1[])
        .filter((item) => item.version === 1 && item.algorithmVersion === OBJECTIVE_ALGORITHM_VERSION)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      request.onerror = () => reject(request.error ?? new Error("Unable to list the analysis index."));
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
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(ANALYSIS_INDEX_STORE, "readwrite");
        transaction.objectStore(ANALYSIS_INDEX_STORE).put(projection(analysis, key, fingerprint), rawKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to backfill the analysis index."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Analysis index backfill was aborted."));
      });
      added += 1;
    }
    return added;
  } finally {
    database.close();
  }
}

export async function getCachedAnalysisByKey(key: string): Promise<GameAnalysisV2 | null> {
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ANALYSIS_STORE, "readonly").objectStore(ANALYSIS_STORE).get(key);
      request.onsuccess = () => {
        const analysis = request.result as GameAnalysisV2 | undefined;
        resolve(analysis?.version === 2 && analysis.algorithmVersion === OBJECTIVE_ALGORITHM_VERSION
          ? withoutStaleCoach(analysis)
          : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Unable to read indexed analysis."));
    });
  } finally {
    database.close();
  }
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
