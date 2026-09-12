import { parsePgn } from "@chess-review/chess-core";
import { exportAnnotatedPgn, type EngineLine, type EngineScore, type StockfishMoveAnalysis } from "@chess-review/shared";
import { describe, expect, it } from "vitest";
import { buildGameAnalysis } from "./game-analysis";

const ANNOTATED_SOURCE = `[Event "Annotated study"]
[Site "Paris"]
[White "Paul Morphy"]
[Black "Duke of Brunswick"]
[Result "*"]

{ A game worth studying }
1. e4 $1 { Best by test } (1. d4 d5 2. c4) e5 2. Nf3 Nc6 3. Bb5 a6 *`;

function engineAnalysis(fen: string, score: EngineScore, pv: string[]): StockfishMoveAnalysis {
  const lines: EngineLine[] = [{ rank: 1, score, depth: 12, pv }];
  const bestMove = pv[0];
  return { fen, score, ...(bestMove === undefined ? {} : { bestMove }), lines, depth: 12 };
}

/** A real canonical analysis, so the fixture cannot drift from the schema. */
function analysisFor(pgn: string) {
  const game = parsePgn(pgn);
  const positionAnalyses = [game.initialFen, ...game.plies.map((ply) => ply.fenAfter)].map((fen, index) => {
    const next = game.plies[index];
    return engineAnalysis(fen, { kind: "cp", cp: 20 }, [next?.uci ?? "a2a3"]);
  });
  return buildGameAnalysis({
    game,
    positionAnalyses,
    // Every played move is the top line, so no restricted re-search is needed.
    playedMoveAnalyses: new Map(game.plies.map((ply) => [
      ply.ply,
      engineAnalysis(ply.fenBefore, { kind: "cp", cp: 20 }, [ply.uci]),
    ])),
    stockfishVersion: "18",
    depth: 12,
    multiPv: 3,
    createdAt: "2026-09-11T00:00:00.000Z",
  });
}

describe("annotated PGN export round trip", () => {
  it("keeps imported comments, NAGs and variations through export and re-import", () => {
    const exported = exportAnnotatedPgn(analysisFor(ANNOTATED_SOURCE));
    const reimported = parsePgn(exported);

    expect(reimported.plies).toHaveLength(6);
    expect(reimported.comment).toBe("A game worth studying");
    expect(reimported.plies[0]?.nags).toEqual([1]);
    expect(reimported.plies[0]?.comment).toContain("Best by test");
    expect(reimported.plies[0]?.comment).toContain("[%eval");
    expect(reimported.plies[0]?.variations).toEqual(["(1. d4 d5 2. c4)"]);
  });

  it("never emits two comments for one move, which the PGN parser rejects", () => {
    const exported = exportAnnotatedPgn(analysisFor(ANNOTATED_SOURCE));
    // `{ a } { b }` after a single move makes the entire file unreadable, so
    // this is the precise invariant the exporter has to hold.
    expect(exported).not.toMatch(/\}\s*\{/);
    expect(() => parsePgn(exported)).not.toThrow();
  });

  it("stays parseable for a game that never had imported annotations", () => {
    const exported = exportAnnotatedPgn(analysisFor("1. e4 e5 2. Nf3 Nc6"));
    expect(() => parsePgn(exported)).not.toThrow();
    expect(parsePgn(exported).plies).toHaveLength(4);
  });
});
