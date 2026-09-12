import { describe, expect, it } from "vitest";
import { parsePgn } from "@chess-review/chess-core";
import type { GameAnalysisV2, PlatformAccount } from "@chess-review/shared";
import { OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import type { ReviewRecord } from "./review-library";
import { buildStudyPlayerLibraries, compactAnalysisForStudy, studyPlayerKey } from "./advanced-study-library";

function analysis(pgn: string, createdAt: string, algorithmVersion = OBJECTIVE_ALGORITHM_VERSION): GameAnalysisV2 {
  return {
    version: 2,
    algorithmVersion,
    game: { headers: { White: "Ada", Black: "Mikhail", Result: "1-0", Date: "2026.07.14" }, initialFen: "fixture", pgn },
    engine: { stockfishVersion: "18", depth: 10, multiPv: 3, classificationMultiPv: 3, verificationPolicyVersion: "fixture", verifiedMoveCount: 0 },
    division: { totalPlies: 0 },
    white: { color: "white", accuracy: 91, phaseAccuracy: {}, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    black: { color: "black", accuracy: 72, phaseAccuracy: {}, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    moves: [],
    criticalMoments: [],
    createdAt,
  };
}

function record(id: string, pgn: string, preferredOrientation?: "white" | "black"): ReviewRecord {
  return {
    id,
    kind: "pgn",
    input: pgn,
    title: "Ada vs Mikhail",
    subtitle: "fixture",
    initialFen: "fixture",
    totalPlies: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    ...(preferredOrientation === undefined ? {} : { preferredOrientation }),
  };
}

describe("advanced study library", () => {
  it("uses the latest current objective cache and keeps a connected account perspective", () => {
    const players = buildStudyPlayerLibraries(
      [record("game-1", "pgn-1", "black")],
      [analysis("pgn-1", "2026-08-01T00:00:00.000Z"), analysis("pgn-1", "2026-08-03T00:00:00.000Z")],
    );

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ key: "manual:mikhail", name: "Mikhail", kind: "manual-player" });
    expect(players[0]?.games[0]).toMatchObject({ playerColor: "black", result: "loss" });
    expect(players[0]?.games[0]?.analysis.createdAt).toBe("2026-08-03T00:00:00.000Z");
    expect(players[0]?.games[0]?.playedAt).toBe("2026-07-14T00:00:00.000Z");
  });

  it("offers both named players for a manual import and ignores stale algorithms", () => {
    const players = buildStudyPlayerLibraries(
      [record("game-1", "pgn-1"), record("game-2", "pgn-stale")],
      [analysis("pgn-1", "2026-08-01T00:00:00.000Z"), analysis("pgn-stale", "2026-08-01T00:00:00.000Z", "old")],
    );

    expect(players.map(({ name }) => name).sort()).toEqual(["Ada", "Mikhail"]);
    expect(players.every(({ games }) => games.length === 1)).toBe(true);
    expect(studyPlayerKey(" ＡＤＡ ")).toBe("ada");
  });

  it("creates a bounded runtime projection without changing objective evidence", () => {
    const source = analysis("pgn-1", "2026-08-01T00:00:00.000Z");
    source.moves = [{
      quality: "best",
      annotations: ["critical"],
      objectiveVersion: "move-quality-v2",
      stockfish: { fen: "root", score: { kind: "cp", cp: 0 }, lines: [{ rank: 1, score: { kind: "cp", cp: 0 }, depth: 15, pv: ["e2e4", "e7e5"] }], depth: 15 },
      human: { version: "human-v2" },
      coach: { summary: "large prose" },
    }] as unknown as GameAnalysisV2["moves"];

    const compact = compactAnalysisForStudy(source);

    expect(compact.moves[0]).toMatchObject({ quality: "best", annotations: ["critical"], stockfish: { lines: [] } });
    expect(compact.moves[0]?.human).toBeUndefined();
    expect(compact.moves[0]?.coach).toBeUndefined();
    expect(source.moves[0]?.stockfish.lines).toHaveLength(1);
  });

  it("keeps same-name connected accounts separate by explicit account identity", () => {
    const first = record("game-1", "pgn-1", "white");
    first.external = { provider: "chesscom", externalGameId: "1", accountId: "cc-ada", username: "Ada", importedAt: "2026-08-01T00:00:00.000Z" };
    const second = record("game-2", "pgn-2", "white");
    second.external = { provider: "lichess", externalGameId: "2", accountId: "li-ada", username: "Ada", importedAt: "2026-08-01T00:00:00.000Z" };
    const accounts: PlatformAccount[] = [
      { id: "cc-ada", provider: "chesscom", username: "Ada", authMode: "public-username", verified: false, linkedAt: "2026-08-01T00:00:00.000Z" },
      { id: "li-ada", provider: "lichess", username: "Ada", authMode: "oauth-pkce", verified: true, linkedAt: "2026-08-01T00:00:00.000Z" },
    ];

    const players = buildStudyPlayerLibraries(
      [first, second],
      [analysis("pgn-1", "2026-08-01T00:00:00.000Z"), analysis("pgn-2", "2026-08-01T00:00:00.000Z")],
      [],
      accounts,
    );

    expect(players.map(({ key }) => key).sort()).toEqual(["account:cc-ada", "account:li-ada"]);
    expect(players.every(({ kind }) => kind === "connected-account")).toBe(true);
  });

  it("still joins analyses whose PGN serialization drifted, by move-sequence identity", () => {
    // Simulate a record whose input PGN was serialized by an older build while
    // the cached analysis stored a different header normalization of the SAME
    // chess game. Both strings parse to the identical move sequence, so exact
    // string matching would silently drop the game.
    const driftPgn = '[Event "Old export"]\n[Site "?"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 * ';
    const parsed = parsePgn(driftPgn);
    const legacy = analysis(parsed.pgn, "2026-08-01T00:00:00.000Z");
    legacy.game.initialFen = parsed.initialFen;
    legacy.moves = parsed.plies.map((ply) => ({
      ply: ply.ply,
      color: ply.color,
      san: ply.san,
      uci: ply.uci,
      fenBefore: ply.fenBefore,
      fenAfter: ply.fenAfter,
      phase: "opening",
      evaluationBefore: { kind: "cp" as const, cp: 0 },
      evaluationAfter: { kind: "cp" as const, cp: 0 },
      playedMoveScore: { kind: "cp" as const, cp: 0 },
      playedMoveOutsideMultiPv: false,
      quality: "good",
      annotations: [],
      objectiveVersion: "move-quality-v2",
      classification: "good",
      classificationReason: { precedenceRule: "win-percent-loss-ladder", qualityRule: "win-percent-loss-ladder", isEngineBest: false, winPercentBefore: 50, winPercentAfter: 50, winPercentLoss: 0, legalMoveCount: 20, isForced: false, isBook: false, isCheckmate: false, isObviousRecapture: false, isTrivialCheckEscape: false, playedMoveOutsideMultiPv: false, exclusions: [] },
      stockfish: { fen: ply.fenBefore, score: { kind: "cp" as const, cp: 0 }, lines: [], depth: 10 },
      accuracy: 100,
      motifs: [],
    } as unknown as GameAnalysisV2["moves"][number]));
    // An older serializer omitted the Site header line.
    const driftedInput = parsed.pgn.replace('[Site "?"]\n', "");
    expect(driftedInput).not.toEqual(legacy.game.pgn);
    const storedRecord = record("game-drift", "older-normalization");
    storedRecord.input = driftedInput;

    const players = buildStudyPlayerLibraries([storedRecord], [legacy]);

    expect(players).toHaveLength(2);
    expect(players.every(({ games }) => games.length === 1)).toBe(true);
  });
});
