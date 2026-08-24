import { describe, expect, it } from "vitest";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import type { MaiaMovesResponse } from "./local-ai";
import {
  analysisLensArrows,
  candidateRankAtSquare,
  compareRecommendations,
  humanCandidateAtSquare,
  stockfishCandidateArrows,
} from "./board-analysis-arrows";

const result: StockfishMoveAnalysis = {
  fen: "start",
  score: { kind: "cp", cp: 24 },
  depth: 12,
  lines: [
    { rank: 1, score: { kind: "cp", cp: 24 }, depth: 12, pv: ["e2e4", "e7e5"] },
    { rank: 2, score: { kind: "cp", cp: 18 }, depth: 12, pv: ["d2d4", "d7d5"] },
    { rank: 3, score: { kind: "cp", cp: 12 }, depth: 12, pv: ["g1f3"] },
  ],
};

const human: MaiaMovesResponse = {
  model: "maia3-5m",
  targetElo: 1400,
  selfElo: 1400,
  opponentElo: 1400,
  candidates: [
    { uci: "g1f3", san: "Nf3", probability: 0.31 },
    { uci: "e2e4", san: "e4", probability: 0.24 },
    { uci: "c2c4", san: "c4", probability: 0.16 },
  ],
  candidateProbabilityMass: 0.71,
  playedMoveProbability: 0.24,
  expectedHumanMove: "g1f3",
  modelPrediction: true,
};

describe("Stockfish board arrows", () => {
  it("projects MultiPV first moves with one coherent objective family", () => {
    expect(stockfishCandidateArrows(result, 2)).toEqual([
      expect.objectContaining({ startSquare: "e2", endSquare: "e4", color: expect.stringContaining("61, 111, 132") }),
      expect.objectContaining({ startSquare: "d2", endSquare: "d4", color: expect.stringContaining("82, 132, 148") }),
    ]);
  });

  it("highlights the selected candidate without changing its semantics", () => {
    expect(stockfishCandidateArrows(result, 3, "d2d4")[1]?.color).toContain(".98");
  });

  it("maps an arrow head click back to the engine rank", () => {
    expect(candidateRankAtSquare(result, "f3", 3)).toBe(3);
    expect(candidateRankAtSquare(result, "f3", 2)).toBeNull();
  });

  it("uses a separate Maia family without merging objective and human semantics", () => {
    expect(analysisLensArrows({ lens: "human", stockfish: result, human, lineCount: 3 })[0]?.color).toContain("104, 137, 111");
    expect(humanCandidateAtSquare(human, "c4", 3)?.uci).toBe("c2c4");
  });

  it("reports Stockfish/Maia disagreement without creating a combined score", () => {
    expect(compareRecommendations(result, human)).toEqual({
      status: "disagreement",
      objectiveUci: "e2e4",
      humanUci: "g1f3",
      humanProbability: 0.31,
      objectiveRankForHuman: 3,
      humanProbabilityForObjective: 0.24,
    });
  });

  it("keeps Browser Stockfish usable when Maia has no offline result", () => {
    expect(analysisLensArrows({ lens: "human", stockfish: result, human: null, lineCount: 3 })).toEqual([]);
    expect(analysisLensArrows({ lens: "objective", stockfish: result, human: null, lineCount: 3 })).toEqual(stockfishCandidateArrows(result, 3));
  });
});
