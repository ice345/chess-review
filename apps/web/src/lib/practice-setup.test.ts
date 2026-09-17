import { describe, expect, it } from "vitest";
import type { GameAnalysisV2, MoveAnalysisV2, MoveQuality, PlayerColor } from "@chess-review/shared";
import { practiceEmptyCopy, practiceSetup, practiceSideName } from "./practice-setup";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/**
 * One practisable fault. The queue is the canonical eligibility rule, so the
 * fixture satisfies it for real: the engine record belongs to the position
 * before the move and names a legal, different alternative.
 */
function fault(ply: number, color: PlayerColor, quality: MoveQuality, options: { book?: boolean; noEvidence?: boolean } = {}): MoveAnalysisV2 {
  const fenBefore = color === "white" ? START : AFTER_E4;
  const bestMove = color === "white" ? "d2d4" : "d7d5";
  const score = { kind: "cp", cp: 20 } as const;
  return {
    ply,
    color,
    san: color === "white" ? "e4" : "e5",
    uci: color === "white" ? "e2e4" : "e7e5",
    fenBefore,
    fenAfter: AFTER_E4,
    phase: "opening",
    evaluationBefore: score,
    evaluationAfter: { kind: "cp", cp: -60 },
    playedMoveScore: { kind: "cp", cp: -60 },
    playedMoveOutsideMultiPv: false,
    classification: quality === "inaccuracy" ? "inaccuracy" : "mistake",
    classificationReason: {
      precedenceRule: "fixture",
      isEngineBest: false,
      winPercentBefore: 52,
      winPercentAfter: 40,
      winPercentLoss: 12,
      legalMoveCount: 20,
      isForced: false,
      isBook: options.book === true,
      isCheckmate: false,
      isObviousRecapture: false,
      isTrivialCheckEscape: false,
      playedMoveOutsideMultiPv: false,
      exclusions: [],
    },
    // A record for another position is exactly how a fault loses its engine
    // evidence, which is one of the two documented exclusions.
    stockfish: options.noEvidence === true
      ? { fen: "8/8/8/8/8/8/8/8 w - - 0 1", score, lines: [], depth: 10 }
      : { fen: fenBefore, bestMove, score, lines: [{ rank: 1, depth: 10, score, pv: [bestMove] }], depth: 10 },
    accuracy: 40,
    motifs: [],
    quality,
    annotations: [],
    objectiveVersion: "move-quality-v2",
  };
}

function setup(moves: MoveAnalysisV2[], overrides: Partial<Parameters<typeof practiceSetup>[0]> = {}) {
  // Only `moves` is read; the rest of a persisted analysis is irrelevant here.
  const analysis = { version: 2, moves } as unknown as GameAnalysisV2;
  return practiceSetup({ analysis, includeInaccuracies: false, selected: null, knownColor: null, ...overrides });
}

describe("practice setup shape", () => {
  it("always offers both sides with their own count", () => {
    const both = setup([fault(1, "white", "mistake"), fault(2, "black", "blunder")]);

    expect(both.sides.map((side) => [side.color, side.count])).toEqual([["white", 1], ["black", 1]]);
  });

  it("keeps an empty side in the selector instead of dropping it", () => {
    // White 0 / Black > 0, then the mirror image: the selector is total either way.
    const whiteEmpty = setup([fault(2, "black", "mistake")]);
    expect(whiteEmpty.sides.map((side) => [side.color, side.count])).toEqual([["white", 0], ["black", 1]]);

    const blackEmpty = setup([fault(1, "white", "mistake")]);
    expect(blackEmpty.sides.map((side) => [side.color, side.count])).toEqual([["white", 1], ["black", 0]]);
  });

  it("stays a valid two-side setup when neither side has anything", () => {
    const nothing = setup([]);

    expect(nothing.sides.map((side) => side.count)).toEqual([0, 0]);
    expect(nothing.selected).toBe("white");
    expect(nothing.startable.count).toBe(0);
  });
});

describe("practice setup selection", () => {
  it("starts the side the visitor selected, both ways round", () => {
    const moves = [fault(1, "white", "mistake"), fault(2, "black", "blunder")];

    expect(setup(moves, { selected: "black" }).startable.color).toBe("black");
    expect(setup(moves, { selected: "white" }).startable.color).toBe("white");
  });

  it("lets an explicit selection override the learner's own colour", () => {
    const moves = [fault(1, "white", "mistake"), fault(2, "black", "blunder")];

    expect(setup(moves, { knownColor: "white" }).selected).toBe("white");
    expect(setup(moves, { knownColor: "white", selected: "black" }).selected).toBe("black");
  });

  it("defaults to the side with more to practise when no learner is known", () => {
    expect(setup([fault(2, "black", "mistake")]).selected).toBe("black");
    expect(setup([fault(1, "white", "mistake")]).selected).toBe("white");
    // A tie, including the empty game, belongs to White.
    expect(setup([fault(1, "white", "mistake"), fault(2, "black", "mistake")]).selected).toBe("white");
  });

  it("selects an empty side when that is the learner's colour, and still explains it", () => {
    const forLearner = setup([fault(2, "black", "mistake")], { knownColor: "white" });

    expect(forLearner.selected).toBe("white");
    expect(forLearner.startable.count).toBe(0);
    expect(practiceEmptyCopy(forLearner.startable)).toContain("White");
  });
});

describe("practice setup filters", () => {
  it("counts inaccuracies only when they are included", () => {
    const moves = [fault(1, "white", "inaccuracy")];

    expect(setup(moves).startable.count).toBe(0);
    expect(setup(moves, { includeInaccuracies: true }).startable.count).toBe(1);
  });

  it("keeps the selected side coherent when the filter changes", () => {
    // Black's extra material is inaccuracies only. Including them must change the
    // counts, never move the highlight off the side that was already selected.
    const moves = [fault(1, "white", "mistake"), fault(2, "black", "inaccuracy"), fault(4, "black", "inaccuracy")];

    const off = setup(moves);
    const on = setup(moves, { includeInaccuracies: true });

    expect(off.selected).toBe("white");
    expect(off.sides.map((side) => side.count)).toEqual([1, 0]);
    expect(on.selected).toBe("white");
    expect(on.sides.map((side) => side.count)).toEqual([1, 2]);

    // An explicit selection is equally untouched by the filter.
    expect(setup(moves, { selected: "black", includeInaccuracies: true }).startable.count).toBe(2);
  });
});

describe("practice empty copy", () => {
  it("separates nothing recorded from something excluded", () => {
    expect(practiceEmptyCopy(setup([]).startable)).toBe("No mistakes were recorded for White.");

    const theory = setup([fault(1, "white", "mistake", { book: true })]).startable;
    expect(theory.count).toBe(0);
    expect(practiceEmptyCopy(theory)).toContain("recognised opening theory");

    const evidence = setup([fault(1, "white", "mistake", { noEvidence: true })]).startable;
    expect(evidence.count).toBe(0);
    expect(practiceEmptyCopy(evidence)).toContain("Engine evidence is not ready");

    const mixed = setup([
      fault(1, "white", "mistake", { book: true }),
      fault(3, "white", "mistake", { noEvidence: true }),
    ]).startable;
    expect(practiceEmptyCopy(mixed)).toBe("1 opening-theory fault and 1 without usable engine evidence were excluded for White.");
  });

  it("names each side the way the setup and the action name it", () => {
    expect(practiceSideName("white")).toBe("White");
    expect(practiceSideName("black")).toBe("Black");
  });
});
