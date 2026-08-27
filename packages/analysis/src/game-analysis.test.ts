import { describe, expect, it } from "vitest";
import { parsePgn, type NormalizedGame } from "@chess-review/chess-core";
import type { EngineLine, EngineScore, StockfishMoveAnalysis } from "@chess-review/shared";
import { buildGameAnalysis, classifyExploratoryMove, OBJECTIVE_ALGORITHM_VERSION } from "./game-analysis";

function engineAnalysis(
  fen: string,
  score: EngineScore,
  lines: Array<{ move: string; score: EngineScore; pv?: string[] }> = [],
): StockfishMoveAnalysis {
  const engineLines: EngineLine[] = lines.map((line, index) => ({
    rank: index + 1,
    score: line.score,
    depth: 15,
    pv: line.pv ?? [line.move],
  }));
  return {
    fen,
    score,
    ...(engineLines[0]?.pv[0] === undefined ? {} : { bestMove: engineLines[0].pv[0] }),
    lines: engineLines,
    depth: 15,
  };
}

function positionSequence(game: NormalizedGame): StockfishMoveAnalysis[] {
  const fens = [game.initialFen, ...game.plies.map((ply) => ply.fenAfter)];
  return fens.map((fen, index) => {
    const ply = game.plies[index];
    const score = { kind: "cp" as const, cp: 15 + index * 5 };
    return engineAnalysis(
      fen,
      score,
      ply
        ? [
            { move: ply.uci, score },
            { move: "a2a3", score: { kind: "cp", cp: score.cp - (ply.color === "white" ? 20 : -20) } },
          ]
        : [],
    );
  });
}

describe("GameAnalysisV2 assembler", () => {
  it("reuses the canonical classifier for temporary analysis-board moves", () => {
    const game = parsePgn("1. e4");
    const move = game.plies[0]!;
    const root = engineAnalysis(game.initialFen, { kind: "cp", cp: 60 }, [
      { move: "d2d4", score: { kind: "cp", cp: 60 } },
      { move: move.uci, score: { kind: "cp", cp: 18 } },
    ]);
    const after = engineAnalysis(game.finalFen, { kind: "cp", cp: 20 });
    const canonical = buildGameAnalysis({
      game,
      positionAnalyses: [root, after],
      stockfishVersion: "18",
      depth: 15,
      multiPv: 2,
      createdAt: "2026-08-22T14:00:00.000Z",
    }).moves[0]!;

    const exploratory = classifyExploratoryMove({ move, rootAnalysis: root });

    expect(exploratory).toMatchObject({
      quality: canonical.quality,
      annotations: canonical.annotations,
      classification: canonical.classification,
      playedMoveScore: canonical.playedMoveScore,
      playedMoveOutsideMultiPv: canonical.playedMoveOutsideMultiPv,
      accuracy: canonical.accuracy,
    });
    expect(exploratory.classificationReason.winPercentLoss).toBe(canonical.classificationReason.winPercentLoss);
  });

  it("requires matching restricted evidence for an exploratory move outside MultiPV", () => {
    const game = parsePgn("1. e4");
    const move = game.plies[0]!;
    const root = engineAnalysis(game.initialFen, { kind: "cp", cp: 80 }, [
      { move: "d2d4", score: { kind: "cp", cp: 80 } },
    ]);
    const restricted = {
      ...engineAnalysis(game.initialFen, { kind: "cp", cp: -180 }, [
        { move: move.uci, score: { kind: "cp", cp: -180 } },
      ]),
      searchMoves: [move.uci],
    };

    expect(classifyExploratoryMove({ move, rootAnalysis: root, playedMoveAnalysis: restricted })).toMatchObject({
      classification: "blunder",
      playedMoveOutsideMultiPv: true,
      classificationReason: { playedMoveOutsideMultiPv: true },
    });
    expect(() => classifyExploratoryMove({ move, rootAnalysis: root })).toThrow(/no root or restricted/);
  });

  it("assembles deterministic canonical move, player, and critical-moment data", () => {
    const game = parsePgn("1. e4 e5 2. Nf3 Nc6");
    const result = buildGameAnalysis({
      game,
      positionAnalyses: positionSequence(game),
      stockfishVersion: "18",
      depth: 15,
      multiPv: 2,
      createdAt: "2026-08-22T14:00:00.000Z",
    });

    expect(result.version).toBe(2);
    expect(result.algorithmVersion).toBe(OBJECTIVE_ALGORITHM_VERSION);
    expect(result.createdAt).toBe("2026-08-22T14:00:00.000Z");
    expect(result.moves).toHaveLength(4);
    expect(result.moves[0]).toMatchObject({
      san: "e4",
      uci: "e2e4",
      classification: "best",
      quality: "best",
      objectiveVersion: "move-quality-v2",
      playedMoveOutsideMultiPv: false,
      evaluationBefore: { kind: "cp", cp: 15 },
    });
    expect(result.white.classificationCounts.best).toBe(2);
    expect(result.black.classificationCounts.best).toBe(2);
    expect(result.white.accuracy).toBeDefined();
    expect(result.criticalMoments).toEqual([]);
  });

  it("uses a restricted root search when the played move is outside MultiPV", () => {
    const game = parsePgn("1. e4");
    const root = engineAnalysis(game.initialFen, { kind: "cp", cp: 120 }, [
      { move: "d2d4", score: { kind: "cp", cp: 120 } },
      { move: "c2c4", score: { kind: "cp", cp: 90 } },
    ]);
    const after = engineAnalysis(game.finalFen, { kind: "cp", cp: -250 });
    const played = engineAnalysis(game.initialFen, { kind: "cp", cp: -300 }, [
      { move: "e2e4", score: { kind: "cp", cp: -300 } },
    ]);

    const result = buildGameAnalysis({
      game,
      positionAnalyses: [root, after],
      playedMoveAnalyses: new Map([[1, played]]),
      stockfishVersion: "18",
      depth: 15,
      multiPv: 2,
      createdAt: "2026-08-22T14:00:00.000Z",
    });

    expect(result.moves[0]).toMatchObject({
      playedMoveScore: { kind: "cp", cp: -300 },
      evaluationAfter: { kind: "cp", cp: -250 },
      playedMoveOutsideMultiPv: true,
      classification: "blunder",
    });
    expect(result.moves[0]?.classificationReason.playedMoveOutsideMultiPv).toBe(true);
    expect(result.criticalMoments).toHaveLength(1);
  });

  it("refuses to mix an after-position score into an unsearched played move", () => {
    const game = parsePgn("1. e4");
    const root = engineAnalysis(game.initialFen, { kind: "cp", cp: 30 }, [
      { move: "d2d4", score: { kind: "cp", cp: 30 } },
    ]);
    const after = engineAnalysis(game.finalFen, { kind: "cp", cp: 10 });
    expect(() => buildGameAnalysis({
      game,
      positionAnalyses: [root, after],
      stockfishVersion: "18",
      depth: 15,
      multiPv: 1,
      createdAt: "2026-08-22T14:00:00.000Z",
    })).toThrow(/outside MultiPV/);
  });

  it("assembles verified PV sacrifice evidence before emitting Brilliant", () => {
    const fen = "rnbq1rk1/ppp2ppp/3b1n2/3p4/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 1";
    const game = parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. Bxh7+ *`);
    const root = engineAnalysis(fen, { kind: "cp", cp: 20 }, [
      {
        move: "d3h7",
        score: { kind: "cp", cp: 30 },
        pv: ["d3h7", "g8h7", "f3g5", "h7g8", "d1h5"],
      },
      { move: "b1c3", score: { kind: "cp", cp: -160 } },
    ]);
    const after = engineAnalysis(game.finalFen, { kind: "cp", cp: 25 });

    const result = buildGameAnalysis({
      game,
      positionAnalyses: [root, after],
      stockfishVersion: "18",
      depth: 18,
      multiPv: 2,
      createdAt: "2026-08-22T14:00:00.000Z",
    });

    expect(result.moves[0]).toMatchObject({
      classification: "brilliant",
      motifs: ["sacrifice"],
      classificationReason: {
        precedenceRule: "verified-nontrivial-sacrifice",
        sacrifice: { genuine: true, sacrificedMaterial: 230, survivesBestResponse: true },
      },
    });
  });

  it("retains missed-mate as an annotation through the full-game assembler", () => {
    const game = parsePgn("1. e4");
    const root = engineAnalysis(game.initialFen, { kind: "mate", mateIn: 4 }, [
      { move: "d2d4", score: { kind: "mate", mateIn: 4 } },
      { move: "e2e4", score: { kind: "cp", cp: 0 } },
    ]);
    const after = engineAnalysis(game.finalFen, { kind: "cp", cp: 0 });

    const result = buildGameAnalysis({
      game,
      positionAnalyses: [root, after],
      stockfishVersion: "18",
      depth: 18,
      multiPv: 3,
      createdAt: "2026-08-26T00:00:00.000Z",
      verifiedPlies: new Set([1]),
      verificationReasons: new Map([[1, ["special-annotation"]]]),
    });

    expect(result.moves[0]).toMatchObject({
      quality: "blunder",
      annotations: ["missed_mate"],
      classification: "missed_mate",
      classificationReason: { verification: { status: "verified" } },
    });
  });
});
