import type { Page } from "@playwright/test";
import { buildGameAnalysis, divideGame, OBJECTIVE_ALGORITHM_VERSION } from "../packages/analysis/src/index";
import { parsePgn } from "../packages/chess-core/src/index";
import type { GameAnalysisV2, HistoryAnalysisJobV1, PlatformAccount, PlatformSyncState, StockfishMoveAnalysis, SyncedGame } from "../packages/shared/src/index";
import { STOCKFISH_VERSION } from "../packages/stockfish/src/index";
import {
  analysisCacheKey,
  analysisGameFingerprint,
  buildAnalysisCacheProjection,
} from "../apps/web/src/lib/analysis-cache";
import { buildReviewRecord, buildReviewRecordFromSyncedGame, type ReviewRecord } from "../apps/web/src/lib/review-library";

export const SAMPLE_PGN = `[Event "Phase 5.1 E2E"]
[White "Ada"]
[Black "Mikhail"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5
7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 *`;

export const SHORT_ANALYSIS_PGN = `[Event "Live Stockfish E2E"]
[White "Ada"]
[Black "Mikhail"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *`;

const DEPTH = 10;
const MULTI_PV = 3;

function positionResult(fen: string, canonicalUci: string | undefined, index: number): StockfishMoveAnalysis {
  const fixtureAlternatives: Record<number, string[]> = {
    // f2f3 and g1f3 deliberately share a destination while remaining
    // different legal candidate identities.
    0: ["f2f3", "g1f3"],
    1: ["c7c5", "e7e6"],
    2: ["b1c3", "d2d4"],
  };
  const first = canonicalUci ?? "a2a3";
  const candidates = [first, ...(fixtureAlternatives[index] ?? [])].slice(0, 3);
  const score = { kind: "cp" as const, cp: 32 + (index % 5) * 7 };
  return {
    fen,
    score,
    bestMove: first,
    lines: candidates.map((candidate, lineIndex) => ({
      rank: lineIndex + 1,
      score: { kind: "cp" as const, cp: score.cp - lineIndex * 18 },
      depth: DEPTH,
      pv: [candidate],
    })),
    depth: DEPTH,
  };
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function reviewFixture({ visualLabels = false } = {}): Promise<{
  record: ReviewRecord;
  analysis: GameAnalysisV2;
  cacheKey: string;
}> {
  const game = parsePgn(SAMPLE_PGN);
  const fens = [game.initialFen, ...game.plies.map((move) => move.fenAfter)];
  const positionAnalyses = fens.map((fen, index) => positionResult(fen, game.plies[index]?.uci, index));
  const base = buildGameAnalysis({
    game,
    positionAnalyses,
    division: divideGame(game),
    stockfishVersion: STOCKFISH_VERSION,
    depth: DEPTH,
    multiPv: MULTI_PV,
    createdAt: "2026-08-23T00:00:00.000Z",
  });
  const analysis = visualLabels ? structuredClone(base) : base;
  if (visualLabels) {
    const brilliant = analysis.moves[0];
    const blunder = analysis.moves[1];
    if (brilliant) {
      brilliant.classification = "brilliant";
      brilliant.annotations = ["sacrifice", "critical", "brilliant"];
    }
    if (blunder) {
      blunder.classification = "blunder";
      blunder.quality = "blunder";
      blunder.classificationReason = {
        ...blunder.classificationReason,
        precedenceRule: "visual-fixture-blunder",
        isEngineBest: false,
        engineRank: 3,
        centipawnLoss: 220,
        winPercentLoss: 28,
      };
      blunder.accuracy = 32;
    }
    analysis.criticalMoments = blunder ? [{ ply: 2, classification: "blunder", winPercentSwing: 28 }] : [];
    analysis.white.classificationCounts = { ...analysis.white.classificationCounts, brilliant: 1, best: Math.max(0, (analysis.white.classificationCounts.best ?? 0) - 1) };
    analysis.white.annotationCounts = { ...analysis.white.annotationCounts, brilliant: 1, critical: 1, sacrifice: 1 };
    analysis.black.classificationCounts = { ...analysis.black.classificationCounts, blunder: 1, best: Math.max(0, (analysis.black.classificationCounts.best ?? 0) - 1) };
    analysis.black.qualityCounts = { ...analysis.black.qualityCounts, blunder: 1, best: Math.max(0, analysis.black.qualityCounts.best - 1) };
  }
  const record = {
    ...await buildReviewRecord("pgn", SAMPLE_PGN),
    createdAt: "2026-08-23T01:00:00.000Z",
    updatedAt: "2026-08-23T01:00:00.000Z",
    preferredOrientation: "white" as const,
  };
  const cacheKey = await digest([
    OBJECTIVE_ALGORITHM_VERSION,
    STOCKFISH_VERSION,
    DEPTH,
    MULTI_PV,
    game.initialFen,
    game.pgn,
  ].join("\u0000"));
  return { record, analysis, cacheKey };
}

async function writeStores(page: Page, values: Record<string, Array<[IDBValidKey, unknown]>>): Promise<void> {
  await page.goto("/");
  await page.evaluate(async ({ values }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("open-chess-review", 6);
      request.onupgradeneeded = () => {
        for (const name of ["objective-analyses", "objective-analysis-index", "review-records", "platform-accounts", "synced-games", "platform-sync-state", "training-queue", "history-analysis-jobs", "player-avatars"]) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await Promise.all(Object.entries(values).map(([name, entries]) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(name, "readwrite");
      const store = transaction.objectStore(name);
      for (const [key, value] of entries) store.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    })));
    database.close();
  }, { values });
}

export async function seedReview(page: Page, options: { visualLabels?: boolean } = {}) {
  const fixture = await reviewFixture(options);
  await writeStores(page, {
    "review-records": [[fixture.record.id, fixture.record]],
    "objective-analyses": [[fixture.cacheKey, fixture.analysis]],
  });
  return fixture;
}

/**
 * History analysis writes the cache from the provider PGN. Review later loads
 * the trimmed record input, which used to miss the PGN-hashed cache key.
 */
export async function seedHistoricalReviewWithPgnDrift(page: Page) {
  const rawPgn = `${SAMPLE_PGN}
`;
  const storedGame = parsePgn(rawPgn);
  const { analysis } = await reviewFixture();
  analysis.game.pgn = storedGame.pgn;
  const cacheKey = await analysisCacheKey(storedGame, { depth: DEPTH, multiPv: MULTI_PV });
  const fingerprint = await analysisGameFingerprint(storedGame);
  const record = {
    ...await buildReviewRecord("pgn", rawPgn),
    createdAt: "2026-08-23T01:00:00.000Z",
    updatedAt: "2026-08-23T01:00:00.000Z",
    preferredOrientation: "white" as const,
  };
  if (record.input === storedGame.pgn) {
    throw new Error("PGN drift fixture did not produce a serialization mismatch.");
  }
  await writeStores(page, {
    "review-records": [[record.id, record]],
    "objective-analyses": [[cacheKey, analysis]],
    "objective-analysis-index": [[cacheKey, buildAnalysisCacheProjection(analysis, cacheKey, fingerprint)]],
  });
  return { record, analysis, cacheKey, storedPgn: storedGame.pgn, reviewPgn: record.input };
}

export async function seedAdvancedStudy(page: Page) {
  const pgns = [
    `[Event "Phase 7 study one"]\n[Date "2026.08.01"]\n[White "Ada"]\n[Black "Mikhail"]\n[Result "0-1"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *`,
    `[Event "Phase 7 study two"]\n[Date "2026.08.02"]\n[White "Ada"]\n[Black "Grace"]\n[Result "1/2-1/2"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 *`,
    `[Event "Phase 7 study three"]\n[Date "2026.08.03"]\n[White "Ada"]\n[Black "Katherine"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 *`,
  ];
  const values: Record<string, Array<[IDBValidKey, unknown]>> = {
    "review-records": [],
    "objective-analyses": [],
  };
  const fixtures: Array<{ record: ReviewRecord; analysis: GameAnalysisV2 }> = [];

  for (const [index, pgn] of pgns.entries()) {
    const game = parsePgn(pgn!);
    const fens = [game.initialFen, ...game.plies.map((move) => move.fenAfter)];
    const analysis = buildGameAnalysis({
      game,
      positionAnalyses: fens.map((fen, positionIndex) => positionResult(fen, game.plies[positionIndex]?.uci, positionIndex)),
      division: divideGame(game),
      opening: { eco: "C50", name: "Italian Game", variation: "Giuoco Piano", matchedPly: 5, theoryUntilPly: 6 },
      stockfishVersion: STOCKFISH_VERSION,
      depth: DEPTH,
      multiPv: MULTI_PV,
      createdAt: `2026-08-0${index + 1}T12:00:00.000Z`,
    });
    const openingError = analysis.moves[0]!;
    openingError.classification = index === 2 ? "blunder" : "mistake";
    openingError.quality = index === 2 ? "blunder" : "mistake";
    openingError.accuracy = index === 2 ? 35 : 55 + index * 5;
    openingError.classificationReason = {
      ...openingError.classificationReason,
      precedenceRule: "phase-7-opening-fixture",
      isEngineBest: false,
      engineRank: 3,
      centipawnLoss: index === 2 ? 240 : 150,
      winPercentAfter: 30 + index * 4,
      winPercentLoss: index === 2 ? 31 : 20 + index * 3,
    };
    const missedChance = analysis.moves[2]!;
    if (index < 2) {
      missedChance.classification = "missed_win";
      missedChance.quality = "blunder";
      missedChance.annotations = ["missed_win"];
      missedChance.accuracy = 28 + index * 4;
      missedChance.classificationReason = {
        ...missedChance.classificationReason,
        precedenceRule: "phase-7-missed-win-fixture",
        isEngineBest: false,
        engineRank: 3,
        centipawnLoss: 280,
        winPercentAfter: 40,
        winPercentLoss: 36 + index * 2,
      };
    }
    if (index === 0) {
      const critical = analysis.moves[4]!;
      critical.classification = "great";
      critical.annotations = ["critical"];
      critical.classificationReason = {
        ...critical.classificationReason,
        precedenceRule: "phase-10-verified-critical-fixture",
        verification: {
          status: "verified",
          depth: 18,
          multiPv: 5,
          reasons: ["special-annotation"],
        },
      };
    }
    analysis.white.accuracy = 72 + index * 6;
    analysis.white.phaseAccuracy.opening = 69 + index * 6;
    analysis.white.classificationCounts = {
      ...analysis.white.classificationCounts,
      best: Math.max(0, (analysis.white.classificationCounts.best ?? 0) - (index < 2 ? 2 : 1)),
      mistake: index < 2 ? 1 : 0,
      blunder: index === 2 ? 1 : 0,
      ...(index < 2 ? { missed_win: 1 } : {}),
    };
    analysis.white.qualityCounts = {
      ...analysis.white.qualityCounts,
      best: Math.max(0, analysis.white.qualityCounts.best - (index < 2 ? 2 : 1)),
      mistake: index < 2 ? 1 : 0,
      blunder: index === 2 ? 1 : index < 2 ? 1 : 0,
    };
    analysis.white.annotationCounts = {
      ...analysis.white.annotationCounts,
      ...(index < 2 ? { missed_win: 1 } : {}),
      ...(index === 0 ? { critical: 1 } : {}),
    };
    const built = await buildReviewRecord("pgn", pgn!);
    const record = {
      ...built,
      createdAt: `2026-08-0${index + 1}T13:00:00.000Z`,
      updatedAt: `2026-08-0${index + 1}T13:00:00.000Z`,
      preferredOrientation: "white" as const,
    };
    const cacheKey = await digest([
      OBJECTIVE_ALGORITHM_VERSION,
      STOCKFISH_VERSION,
      DEPTH,
      MULTI_PV,
      game.initialFen,
      game.pgn,
    ].join("\u0000"));
    values["review-records"]!.push([record.id, record]);
    values["objective-analyses"]!.push([cacheKey, analysis]);
    fixtures.push({ record, analysis });
  }

  await writeStores(page, values);
  return fixtures;
}

export async function seedUnanalyzedReview(page: Page, pgn = SHORT_ANALYSIS_PGN) {
  const record = await buildReviewRecord("pgn", pgn);
  await writeStores(page, { "review-records": [[record.id, record]] });
  return record;
}

export async function seedConnectedLibrary(page: Page, gameCount = 84): Promise<{ account: PlatformAccount; games: SyncedGame[] }> {
  const account: PlatformAccount = {
    id: "chesscom:hikaru",
    provider: "chesscom",
    username: "Hikaru",
    displayName: "Hikaru Nakamura",
    avatarUrl: "https://images.example/avatar.png",
    authMode: "public-username",
    verified: false,
    linkedAt: "2026-08-20T00:00:00.000Z",
    lastSyncAt: "2026-08-23T00:00:00.000Z",
    ratings: { rapid: 2810, blitz: 2901 },
  };
  const sync: PlatformSyncState = {
    accountId: account.id,
    provider: "chesscom",
    status: "paused",
    mode: "full-history",
    cursor: "cc:10:50",
    importedCount: gameCount,
    completedBatches: 4,
    completedUnits: 10,
    totalUnits: 152,
  };
  const games: SyncedGame[] = Array.from({ length: gameCount }, (_, index) => ({
    id: `chesscom:fixture-${index}`,
    external: {
      provider: "chesscom",
      externalGameId: `fixture-${index}`,
      accountId: account.id,
      username: account.username,
      url: `https://www.chess.com/game/live/${index}`,
      importedAt: "2026-08-23T00:00:00.000Z",
    },
    pgn: SAMPLE_PGN,
    playedAt: new Date(Date.UTC(2026, 7, 23, 0, 0, -index)).toISOString(),
    timeClass: index % 2 === 0 ? "blitz" : "rapid",
    timeControl: index % 2 === 0 ? "180+2" : "600",
    white: { username: index % 2 === 0 ? "Hikaru" : `Opponent${index}`, rating: 2800 },
    black: { username: index % 2 === 0 ? `Opponent${index}` : "Hikaru", rating: 2750 },
    accountColor: index % 2 === 0 ? "white" : "black",
    analyzed: false,
    syncedAt: "2026-08-23T00:00:00.000Z",
  }));
  await writeStores(page, {
    "platform-accounts": [[account.id, account]],
    "platform-sync-state": [[account.id, sync]],
    "synced-games": games.map((game) => [game.id, game]),
  });
  return { account, games };
}

export async function seedPausedHistoryJob(page: Page, gameIds: string[]): Promise<HistoryAnalysisJobV1> {
  const job: HistoryAnalysisJobV1 = {
    version: 1,
    id: "history-job-fixture",
    status: "paused",
    scope: { providers: [], accountIds: [], timeClasses: [], rated: "all", freshness: "all" },
    objectiveAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    depth: DEPTH,
    classificationMultiPv: MULTI_PV,
    items: gameIds.map((gameId) => ({ gameId, status: "queued", attempts: 1, updatedAt: "2026-08-23T00:00:00.000Z" })),
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
  await writeStores(page, { "history-analysis-jobs": [[job.id, job]] });
  return job;
}

export async function seedPartialHistoryJob(page: Page): Promise<void> {
  const connected = await seedConnectedLibrary(page, 2);
  const fixture = await reviewFixture();
  const successfulGame = connected.games[0]!;
  const successfulRecord = await buildReviewRecordFromSyncedGame(successfulGame);
  const analyzedGame: SyncedGame = {
    ...successfulGame,
    analyzed: true,
    analysisId: successfulRecord.id,
    analysisAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    analysisDepth: DEPTH,
    analyzedAt: "2026-08-24T00:00:00.000Z",
  };
  // The real background path writes a connected review record before the
  // engine request completes. Keep a failed record here as well: it shares
  // the successful game's PGN and must not be promoted by that cache.
  const failedRecord = await buildReviewRecordFromSyncedGame(connected.games[1]!);
  await writeStores(page, {
    "objective-analyses": [[fixture.cacheKey, fixture.analysis]],
    "review-records": [[failedRecord.id, failedRecord]],
    "synced-games": [[analyzedGame.id, analyzedGame]],
  });
  const job = await seedPausedHistoryJob(page, ["chesscom:fixture-0", "chesscom:fixture-1"]);
  await page.evaluate(async ({ jobId, analysisId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("open-chess-review", 6);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("history-analysis-jobs", "readwrite");
    const store = transaction.objectStore("history-analysis-jobs");
    const current = await new Promise<HistoryAnalysisJobV1>((resolve, reject) => {
      const request = store.get(jobId);
      request.onsuccess = () => resolve(request.result as HistoryAnalysisJobV1);
      request.onerror = () => reject(request.error);
    });
    const timestamp = "2026-08-24T00:00:00.000Z";
    store.put({
      ...current,
      status: "failed",
      error: "Some games failed. Retry only the failed items.",
      updatedAt: timestamp,
      completedAt: timestamp,
      items: [
        { ...current.items[0], status: "cached", attempts: 1, analysisId, updatedAt: timestamp },
        { ...current.items[1], status: "failed", attempts: 2, error: "Stockfish worker exited before returning a completed line.", updatedAt: timestamp },
      ],
    }, jobId);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { jobId: job.id, analysisId: successfulRecord.id });
}

export async function mockLocalAi(
  page: Page,
  state: "available" | "offline" = "available",
  options: { positionCandidates?: string[]; responseDelayMs?: number } = {},
): Promise<{ requests: Array<{ path: string; body: Record<string, unknown> }> }> {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route(/http:\/\/(?:127\.0\.0\.1|localhost):8000\/.*/, async (route) => {
    if (state === "offline") return route.abort("connectionrefused");
    const url = new URL(route.request().url());
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (url.pathname === "/health") return route.fulfill({ status: 200, headers, json: {
      status: "ok",
      maia: "available",
      maiaModels: { "maia3-5m": "cached", "maia3-23m": "cached", "maia3-79m": "not-cached" },
      coach: { ollama: "available", ollamaModel: "available", configuredModel: "fixture", ollamaModels: ["fixture", "gemma4:12b-it-qat"], openaiCompatible: "not-configured" },
    } });
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    if (url.pathname.startsWith("/maia/") || url.pathname.startsWith("/coach/")) requests.push({ path: url.pathname, body });
    if (options.responseDelayMs) await new Promise((resolve) => setTimeout(resolve, options.responseDelayMs));
    if (url.pathname.endsWith("/download")) return route.fulfill({ status: 200, headers, json: { model: url.pathname.split("/")[3], status: "cached" } });
    if (url.pathname === "/maia/move-review") {
      const played = String(body.played_move);
      const supplied = Array.isArray(body.candidate_moves) ? body.candidate_moves.map(String) : [];
      const moves = [...new Set([...supplied, played])];
      const playedRank = Math.max(1, moves.indexOf(played) + 1);
      const probabilities = [.41, .27, .11, .07, .04];
      const candidates = moves.slice(0, 5).map((uci, index) => ({
        uci,
        san: uci,
        probability: probabilities[index] ?? .02,
        policy_rank: index + 1,
        wdl: { win: .39, draw: .31, loss: .3 },
      }));
      return route.fulfill({ status: 200, headers, json: {
        kind: "move-review",
        fen_before: body.fen_before,
        played_move: played,
        model: body.model,
        target_elo: body.target_elo,
        self_elo: body.self_elo,
        opponent_elo: body.opponent_elo,
        candidates,
        candidate_probability_mass: Math.min(.99, candidates.reduce((sum, candidate) => sum + candidate.probability, 0)),
        played_move_probability: probabilities[playedRank - 1] ?? .02,
        played_move_rank: playedRank,
        expected_human_move: candidates[0]?.uci ?? null,
        played_move_wdl: { win: .39, draw: .31, loss: .3 },
        model_prediction: true,
      } });
    }
    if (url.pathname === "/maia/position-analysis") {
      const supplied = options.positionCandidates ?? (Array.isArray(body.candidate_moves) ? body.candidate_moves.map(String) : []);
      const probabilities = [.41, .27, .11, .07, .04];
      const candidates = supplied.slice(0, 5).map((uci, index) => ({
        uci,
        san: uci,
        probability: probabilities[index] ?? .02,
        policy_rank: index + 1,
        wdl: { win: .39, draw: .31, loss: .3 },
      }));
      return route.fulfill({ status: 200, headers, json: {
        kind: "position-analysis",
        fen: body.fen,
        side_to_move: String(body.fen).split(" ")[1] === "b" ? "black" : "white",
        model: body.model,
        target_elo: body.target_elo,
        self_elo: body.self_elo,
        opponent_elo: body.opponent_elo,
        candidates,
        evaluated_candidates: candidates,
        candidate_probability_mass: Math.min(.99, candidates.reduce((sum, candidate) => sum + candidate.probability, 0)),
        root_wdl: { win: .46, draw: .32, loss: .22 },
        expected_human_move: candidates[0]?.uci ?? null,
        model_prediction: true,
      } });
    }
    return route.fulfill({ status: 503, headers, json: { detail: "deterministic e2e fallback" } });
  });
  return { requests };
}
