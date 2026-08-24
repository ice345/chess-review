import type { Page } from "@playwright/test";
import { buildGameAnalysis, divideGame, OBJECTIVE_ALGORITHM_VERSION } from "../packages/analysis/src/index";
import { parsePgn } from "../packages/chess-core/src/index";
import type { GameAnalysisV1, PlatformAccount, PlatformSyncState, StockfishMoveAnalysis, SyncedGame } from "../packages/shared/src/index";
import { STOCKFISH_VERSION } from "../packages/stockfish/src/index";
import { buildReviewRecord, type ReviewRecord } from "../apps/web/src/lib/review-library";

export const SAMPLE_PGN = `[Event "Phase 5.1 E2E"]
[White "Ada"]
[Black "Mikhail"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5
7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 *`;

const DEPTH = 10;
const MULTI_PV = 3;

function positionResult(fen: string, canonicalUci: string | undefined, index: number): StockfishMoveAnalysis {
  const fixtureAlternatives: Record<number, string[]> = {
    0: ["d2d4", "g1f3"],
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
  analysis: GameAnalysisV1;
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
    if (brilliant) brilliant.classification = "brilliant";
    if (blunder) {
      blunder.classification = "blunder";
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
    analysis.black.classificationCounts = { ...analysis.black.classificationCounts, blunder: 1, best: Math.max(0, (analysis.black.classificationCounts.best ?? 0) - 1) };
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
      const request = indexedDB.open("open-chess-review", 3);
      request.onupgradeneeded = () => {
        for (const name of ["objective-analyses", "review-records", "platform-accounts", "synced-games", "platform-sync-state"]) {
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

export async function seedConnectedLibrary(page: Page, gameCount = 84): Promise<void> {
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
}

export async function mockLocalAi(page: Page, state: "available" | "offline" = "available"): Promise<void> {
  await page.route(/http:\/\/(?:127\.0\.0\.1|localhost):8000\/.*/, async (route) => {
    if (state === "offline") return route.abort("connectionrefused");
    const url = new URL(route.request().url());
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (url.pathname === "/health") return route.fulfill({ status: 200, headers, json: {
      status: "ok",
      maia: "available",
      coach: { ollama: "available", ollamaModel: "available", configuredModel: "fixture", ollamaModels: ["fixture"], openaiCompatible: "not-configured" },
    } });
    if (url.pathname === "/maia/moves") return route.fulfill({ status: 200, headers, json: {
      model: "maia3-5m",
      target_elo: 1400,
      self_elo: 1400,
      opponent_elo: 1400,
      candidates: [
        { uci: "e2e4", san: "e4", probability: .41 },
        { uci: "d2d4", san: "d4", probability: .27 },
        { uci: "g1f3", san: "Nf3", probability: .11 },
      ],
      candidate_probability_mass: .79,
      played_move_probability: .41,
      expected_human_move: "e2e4",
      human_wdl: { win: .39, draw: .31, loss: .3 },
      model_prediction: true,
    } });
    return route.fulfill({ status: 503, headers, json: { detail: "deterministic e2e fallback" } });
  });
}
