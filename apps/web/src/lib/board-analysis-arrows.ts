import type { Arrow } from "react-chessboard";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import type { MaiaPositionAnalysis } from "@chess-review/shared";

export type AnalysisMode = "stockfish" | "maia" | "compare";

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

export interface StockfishCandidateIdentity {
  fen: string;
  rank: number;
  uci: string;
  pvKey: string;
}

export interface HumanCandidateIdentity {
  fen: string;
  model: MaiaPositionAnalysis["model"];
  targetElo: number;
  uci: string;
}

export function stockfishCandidateIdentity(
  result: StockfishMoveAnalysis,
  line: StockfishMoveAnalysis["lines"][number],
): StockfishCandidateIdentity | null {
  const uci = line.pv[0];
  if (!uci) return null;
  return { fen: result.fen, rank: line.rank, uci, pvKey: line.pv.join("\u0000") };
}

export function matchingStockfishCandidate(
  result: StockfishMoveAnalysis | null,
  identity: StockfishCandidateIdentity,
): StockfishMoveAnalysis["lines"][number] | null {
  if (!result || result.fen !== identity.fen) return null;
  return result.lines.find((line) => (
    line.rank === identity.rank
    && line.pv[0] === identity.uci
    && line.pv.join("\u0000") === identity.pvKey
  )) ?? null;
}

export function humanCandidateIdentity(
  result: MaiaPositionAnalysis,
  candidate: MaiaPositionAnalysis["candidates"][number],
): HumanCandidateIdentity {
  return {
    fen: result.fen,
    model: result.model,
    targetElo: result.targetElo,
    uci: candidate.uci,
  };
}

export function matchingHumanCandidate(
  result: MaiaPositionAnalysis | null,
  identity: HumanCandidateIdentity,
): MaiaPositionAnalysis["candidates"][number] | null {
  if (
    !result
    || result.fen !== identity.fen
    || result.model !== identity.model
    || result.targetElo !== identity.targetElo
  ) return null;
  return result.candidates.find((candidate) => candidate.uci === identity.uci) ?? null;
}

export function stockfishCandidateArrows(
  result: StockfishMoveAnalysis | null,
  lineCount: number,
  selectedUci?: string,
): Arrow[] {
  return (result?.lines ?? []).slice(0, lineCount).flatMap((line, index) => {
    const move = arrowMove(line.pv[0]);
    if (!move) return [];
    const selected = selectedUci === line.pv[0];
    return [{
      ...move,
      color: selected ? "rgba(45, 91, 111, .98)" : OBJECTIVE_ARROW_COLORS[index] ?? OBJECTIVE_ARROW_COLORS.at(-1)!,
    }];
  });
}

export function humanCandidateArrows(
  result: MaiaPositionAnalysis | null,
  lineCount: number,
  selectedUci?: string,
): Arrow[] {
  return (result?.candidates ?? []).slice(0, lineCount).flatMap((candidate, index) => {
    const move = arrowMove(candidate.uci);
    if (!move) return [];
    const selected = selectedUci === candidate.uci;
    return [{
      ...move,
      color: selected ? "rgba(80, 117, 86, .98)" : HUMAN_ARROW_COLORS[index] ?? HUMAN_ARROW_COLORS.at(-1)!,
    }];
  });
}

export function analysisModeArrows({
  mode,
  stockfish,
  human,
  lineCount,
  selectedUci,
}: {
  mode: AnalysisMode;
  stockfish: StockfishMoveAnalysis | null;
  human: MaiaPositionAnalysis | null;
  lineCount: number;
  selectedUci?: string;
}): Arrow[] {
  if (mode === "stockfish") return stockfishCandidateArrows(stockfish, lineCount, selectedUci);
  if (mode === "maia") return humanCandidateArrows(human, lineCount, selectedUci);
  const objective = stockfishCandidateArrows(stockfish, lineCount, selectedUci);
  const humanArrows = humanCandidateArrows(human, lineCount, selectedUci);
  const objectiveUcis = (stockfish?.lines ?? []).slice(0, lineCount).map((line) => line.pv[0]);
  const humanUcis = (human?.candidates ?? []).slice(0, lineCount).map((candidate) => candidate.uci);
  const sharedUcis = new Set(objectiveUcis.filter((uci): uci is string => typeof uci === "string" && humanUcis.includes(uci)));
  return [
    ...objective.map((arrow, index) => sharedUcis.has(objectiveUcis[index] ?? "")
      ? { ...arrow, color: "rgba(76, 126, 126, .96)" }
      : arrow),
    ...humanArrows.filter((_, index) => !sharedUcis.has(humanUcis[index] ?? "")),
  ];
}

export function overlappingCandidateUcis(
  stockfish: StockfishMoveAnalysis | null,
  human: MaiaPositionAnalysis | null,
  lineCount: number,
): string[] {
  const humanUcis = new Set((human?.candidates ?? []).slice(0, lineCount).map((candidate) => candidate.uci));
  return (stockfish?.lines ?? [])
    .slice(0, lineCount)
    .flatMap((line) => line.pv[0] && humanUcis.has(line.pv[0]) ? [line.pv[0]] : []);
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
  human: MaiaPositionAnalysis | null,
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
