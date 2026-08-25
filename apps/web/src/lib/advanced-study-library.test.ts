import { describe, expect, it } from "vitest";
import type { GameAnalysisV1 } from "@chess-review/shared";
import type { ReviewRecord } from "./review-library";
import { buildStudyPlayerLibraries, studyPlayerKey } from "./advanced-study-library";

function analysis(pgn: string, createdAt: string, algorithmVersion = "objective-v1-preview.3"): GameAnalysisV1 {
  return {
    version: 1,
    algorithmVersion,
    game: { headers: { White: "Ada", Black: "Mikhail", Result: "1-0", Date: "2026.07.14" }, initialFen: "fixture", pgn },
    engine: { stockfishVersion: "18", depth: 10, multiPv: 3 },
    division: { totalPlies: 0 },
    white: { color: "white", accuracy: 91, phaseAccuracy: {}, classificationCounts: {} },
    black: { color: "black", accuracy: 72, phaseAccuracy: {}, classificationCounts: {} },
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
    expect(players[0]).toMatchObject({ key: "mikhail", name: "Mikhail" });
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
});
