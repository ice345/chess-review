import type { Arrow } from "react-chessboard";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import type { MaiaMovesResponse } from "./local-ai";

export type AnalysisLens = "objective" | "human";

const OBJECTIVE_ARROW_COLORS = [
  "rgba(61, 111, 132, .88)",
  "rgba(82, 132, 148, .68)",
  "rgba(106, 150, 160, .52)",
  "rgba(126, 163, 169, .42)",
  "rgba(145, 176, 180, .34)",
] as const;

const HUMAN_ARROW_COLORS = [
  "rgba(104, 137, 111, .88)",
  "rgba(121, 151, 124, .68)",
  "rgba(139, 165, 139, .52)",
  "rgba(154, 177, 153, .42)",
  "rgba(169, 188, 166, .34)",
] as const;

function arrowMove(uci: string | undefined): { startSquare: string; endSquare: string } | null {
  if (!uci || uci.length < 4) return null;
  return { startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4) };
}

export function stockfishCandidateArrows(
  result: StockfishMoveAnalysis | null,
  lineCount: number,
  selectedUci?: string,
): Arrow[] {
  return (result?.lines ?? []).slice(0, lineCount).flatMap((line, index) => {
    const move = arrowMove(line.pv[0]);
    if (!move) return [];
    const selected = selectedUci?.slice(0, 4) === line.pv[0]?.slice(0, 4);
    return [{
      ...move,
      color: selected ? "rgba(45, 91, 111, .98)" : OBJECTIVE_ARROW_COLORS[index] ?? OBJECTIVE_ARROW_COLORS.at(-1)!,
    }];
  });
}

export function candidateRankAtSquare(
  result: StockfishMoveAnalysis | null,
  square: string,
  lineCount: number,
): number | null {
  return result?.lines.slice(0, lineCount).find((line) => line.pv[0]?.slice(2, 4) === square)?.rank ?? null;
}

export function humanCandidateArrows(
  result: MaiaMovesResponse | null,
  lineCount: number,
  selectedUci?: string,
): Arrow[] {
  return (result?.candidates ?? []).slice(0, lineCount).flatMap((candidate, index) => {
    const move = arrowMove(candidate.uci);
    if (!move) return [];
    const selected = selectedUci?.slice(0, 4) === candidate.uci.slice(0, 4);
    return [{
      ...move,
      color: selected ? "rgba(80, 117, 86, .98)" : HUMAN_ARROW_COLORS[index] ?? HUMAN_ARROW_COLORS.at(-1)!,
    }];
  });
}

export function humanCandidateAtSquare(
  result: MaiaMovesResponse | null,
  square: string,
  lineCount: number,
) {
  return result?.candidates.slice(0, lineCount).find((candidate) => candidate.uci.slice(2, 4) === square) ?? null;
}

export function analysisLensArrows({
  lens,
  stockfish,
  human,
  lineCount,
  selectedUci,
}: {
  lens: AnalysisLens;
  stockfish: StockfishMoveAnalysis | null;
  human: MaiaMovesResponse | null;
  lineCount: number;
  selectedUci?: string;
}): Arrow[] {
  if (lens === "objective") return stockfishCandidateArrows(stockfish, lineCount, selectedUci);
  return humanCandidateArrows(human, lineCount, selectedUci);
}

export interface RecommendationComparison {
  status: "agreement" | "disagreement" | "insufficient";
  objectiveUci?: string;
  humanUci?: string;
  humanProbability?: number;
  objectiveRankForHuman?: number;
  humanProbabilityForObjective?: number;
}

export function compareRecommendations(
  stockfish: StockfishMoveAnalysis | null,
  human: MaiaMovesResponse | null,
): RecommendationComparison {
  const objectiveUci = stockfish?.lines[0]?.pv[0];
  const humanCandidate = human?.candidates[0];
  if (!objectiveUci || !humanCandidate) return { status: "insufficient" };
  const objectiveRankForHuman = stockfish?.lines.find((line) => line.pv[0] === humanCandidate.uci)?.rank;
  const humanProbabilityForObjective = human?.candidates.find((candidate) => candidate.uci === objectiveUci)?.probability;
  return {
    status: objectiveUci === humanCandidate.uci ? "agreement" : "disagreement",
    objectiveUci,
    humanUci: humanCandidate.uci,
    humanProbability: humanCandidate.probability,
    ...(objectiveRankForHuman === undefined ? {} : { objectiveRankForHuman }),
    ...(humanProbabilityForObjective === undefined ? {} : { humanProbabilityForObjective }),
  };
}
