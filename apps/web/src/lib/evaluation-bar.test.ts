import { describe, expect, it } from "vitest";
import { winPercentFromScore } from "@chess-review/analysis";
import type { MaiaPositionAnalysis } from "@chess-review/shared";
import { evaluationBarPresentation, humanWdlFromWhitePerspective } from "./evaluation-bar";

const maia: MaiaPositionAnalysis = {
  kind: "position-analysis",
  fen: "8/8/8/8/8/8/K6k/8 b - - 0 1",
  sideToMove: "black",
  model: "maia3-23m",
  targetElo: 1600,
  selfElo: 1600,
  opponentElo: 1600,
  candidates: [],
  evaluatedCandidates: [],
  candidateProbabilityMass: 0,
  rootWdl: { win: 0.6, draw: 0.2, loss: 0.2 },
  modelPrediction: true,
};

describe("source-aware evaluation bar", () => {
  it("keeps Stockfish on the canonical White-POV WinPercent curve", () => {
    const score = { kind: "cp", cp: 420 } as const;
    const presentation = evaluationBarPresentation({ mode: "stockfish", stockfish: score, maia }, "white");
    expect(presentation.whitePercent).toBe(winPercentFromScore(score));
    expect(presentation.sourceLabel).toBe("Stockfish objective evaluation");
  });

  it("converts side-to-move Maia WDL to White perspective without centipawns", () => {
    expect(humanWdlFromWhitePerspective(maia.rootWdl, "black")).toEqual({
      whiteWinPercent: 20,
      drawPercent: 20,
      blackWinPercent: 60,
      whiteExpectedPercent: 30,
    });
    const presentation = evaluationBarPresentation({ mode: "maia", stockfish: { kind: "cp", cp: 900 }, maia }, "white");
    expect(presentation.whitePercent).toBe(30);
    expect(presentation.sourceLabel).toContain("human-game WDL");
    expect(presentation.ariaLabel).toContain("maia3-23m at Elo 1600");
  });

  it("uses Stockfish as primary and a separate Maia marker in Compare", () => {
    const score = { kind: "mate", mateIn: 3 } as const;
    const compare = evaluationBarPresentation({ mode: "compare", stockfish: score, maia }, "white");
    expect(compare.whitePercent).toBe(winPercentFromScore(score));
    expect(compare.maia?.markerTopPercent).toBe(70);
  });

  it("flips only presentation when board orientation changes", () => {
    const input = { mode: "maia" as const, stockfish: null, maia };
    const white = evaluationBarPresentation(input, "white");
    const black = evaluationBarPresentation(input, "black");
    expect(white.whitePercent).toBe(black.whitePercent);
    expect(white.topColor).toBe("black");
    expect(black.topColor).toBe("white");
    expect(white.topPercent).toBe(black.bottomPercent);
    expect(white.maia?.markerTopPercent).toBe(70);
    expect(black.maia?.markerTopPercent).toBe(30);
  });

  it("hides stale Maia presentation immediately after a position/model switch", () => {
    const stale = { ...maia, model: "maia3-5m" as const };
    const pending = evaluationBarPresentation({ mode: "maia", stockfish: null, maia: null }, "black");
    expect(pending.whitePercent).toBe(50);
    expect(pending.maia).toBeUndefined();
    expect(evaluationBarPresentation({ mode: "maia", stockfish: null, maia: stale }, "black").maia?.model)
      .toBe("maia3-5m");
  });
});
