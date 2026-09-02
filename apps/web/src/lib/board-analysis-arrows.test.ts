import { describe, expect, it } from "vitest";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import type { MaiaPositionAnalysis } from "@chess-review/shared";
import {
  analysisModeArrows,
  compareRecommendations,
  humanCandidateIdentity,
  matchingHumanCandidate,
  matchingStockfishCandidate,
  overlappingCandidateUcis,
  stockfishCandidateIdentity,
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

const human: MaiaPositionAnalysis = {
  kind: "position-analysis",
  fen: "start",
  sideToMove: "white",
  model: "maia3-5m",
  targetElo: 1400,
  selfElo: 1400,
  opponentElo: 1400,
  candidates: [
    { uci: "g1f3", san: "Nf3", probability: 0.31, policyRank: 1 },
    { uci: "e2e4", san: "e4", probability: 0.24, policyRank: 2 },
    { uci: "c2c4", san: "c4", probability: 0.16, policyRank: 3 },
  ],
  evaluatedCandidates: [],
  candidateProbabilityMass: 0.71,
  rootWdl: { win: 0.4, draw: 0.35, loss: 0.25 },
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

  it("identifies Stockfish rows by root, rank, exact UCI and complete PV", () => {
    const line = result.lines[2]!;
    const identity = stockfishCandidateIdentity(result, line)!;
    expect(matchingStockfishCandidate(result, identity)).toBe(line);
    expect(matchingStockfishCandidate(result, { ...identity, uci: "f2f3" })).toBeNull();
    expect(matchingStockfishCandidate(result, { ...identity, pvKey: "g1f3\u0000d7d5" })).toBeNull();
  });

  it("uses a separate Maia family without merging objective and human semantics", () => {
    expect(analysisModeArrows({ mode: "maia", stockfish: result, human, lineCount: 3 })[0]?.color).toContain("104, 137, 111");
    const identity = humanCandidateIdentity(human, human.candidates[2]!);
    expect(matchingHumanCandidate(human, identity)?.uci).toBe("c2c4");
    expect(matchingHumanCandidate(human, { ...identity, uci: "b1c3" })).toBeNull();
  });

  it("keeps moves with a shared destination distinct instead of treating the square as identity", () => {
    const sharedDestination: StockfishMoveAnalysis = {
      ...result,
      lines: [
        { rank: 1, score: result.score, depth: 12, pv: ["f2f3"] },
        { rank: 2, score: result.score, depth: 12, pv: ["g1f3"] },
      ],
    };
    const identities = sharedDestination.lines.map((line) => stockfishCandidateIdentity(sharedDestination, line));
    expect(identities.map((identity) => identity?.uci)).toEqual(["f2f3", "g1f3"]);
    expect(identities[0]).not.toEqual(identities[1]);
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
    expect(analysisModeArrows({ mode: "maia", stockfish: result, human: null, lineCount: 3 })).toEqual([]);
    expect(analysisModeArrows({ mode: "stockfish", stockfish: result, human: null, lineCount: 3 })).toEqual(stockfishCandidateArrows(result, 3));
  });

  it("keeps a selected underpromotion color when collapsing shared promotion squares", () => {
    const promotion: StockfishMoveAnalysis = {
      ...result,
      lines: [
        { rank: 1, score: result.score, depth: 12, pv: ["g7g8q"] },
        { rank: 2, score: result.score, depth: 12, pv: ["g7g8n"] },
      ],
    };
    const arrows = stockfishCandidateArrows(promotion, 2, "g7g8n");
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({ startSquare: "g7", endSquare: "g8", color: expect.stringContaining(".98") });
  });

  it("collapses promotion variants that share the same start and end squares", () => {
    const promotion: StockfishMoveAnalysis = {
      ...result,
      lines: [
        { rank: 1, score: result.score, depth: 12, pv: ["g7g8q"] },
        { rank: 2, score: result.score, depth: 12, pv: ["g7g8n"] },
        { rank: 3, score: result.score, depth: 12, pv: ["e7e8q"] },
      ],
    };
    const arrows = stockfishCandidateArrows(promotion, 3);
    expect(arrows).toHaveLength(2);
    expect(arrows.map((arrow) => `${arrow.startSquare}-${arrow.endSquare}`)).toEqual(["g7-g8", "e7-e8"]);
  });

  it("keeps both candidate families visible in Compare mode", () => {
    const arrows = analysisModeArrows({ mode: "compare", stockfish: result, human, lineCount: 2 });
    expect(arrows).toHaveLength(3);
    expect(arrows[0]?.color).toContain("76, 126, 126");
    expect(arrows[2]?.color).toContain("104, 137, 111");
    expect(overlappingCandidateUcis(result, human, 2)).toEqual(["e2e4"]);
  });

  it("marks only exact UCI overlap and has no Stockfish-first destination bias", () => {
    const sharedDestinationHuman = {
      ...human,
      candidates: [
        { uci: "f2f3", san: "f3", probability: 0.4, policyRank: 1 },
        { uci: "g1f3", san: "Nf3", probability: 0.3, policyRank: 2 },
      ],
    } satisfies MaiaPositionAnalysis;
    const sharedDestinationStockfish = {
      ...result,
      lines: [
        { rank: 1, score: result.score, depth: 12, pv: ["g1f3"] },
        { rank: 2, score: result.score, depth: 12, pv: ["d1f3"] },
      ],
    } satisfies StockfishMoveAnalysis;
    const arrows = analysisModeArrows({ mode: "compare", stockfish: sharedDestinationStockfish, human: sharedDestinationHuman, lineCount: 2 });
    expect(overlappingCandidateUcis(sharedDestinationStockfish, sharedDestinationHuman, 2)).toEqual(["g1f3"]);
    expect(arrows).toHaveLength(3);
    expect(arrows.filter((arrow) => arrow.color.includes("76, 126, 126"))).toHaveLength(1);
  });
});
