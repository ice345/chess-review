import { winPercentFromScore } from "@chess-review/analysis";
import type { EngineScore, HumanWdl, MaiaPositionAnalysis } from "@chess-review/shared";

export type BoardOrientation = "white" | "black";
export type EvaluationMode = "stockfish" | "maia" | "compare";

export interface WhiteHumanWdl {
  whiteWinPercent: number;
  drawPercent: number;
  blackWinPercent: number;
  whiteExpectedPercent: number;
}

export interface EvaluationBarPresentation {
  mode: EvaluationMode;
  whitePercent: number;
  blackPercent: number;
  topColor: BoardOrientation;
  topPercent: number;
  bottomColor: BoardOrientation;
  bottomPercent: number;
  sourceLabel: string;
  ariaLabel: string;
  maia?: WhiteHumanWdl & {
    sideToMove: "white" | "black";
    targetElo: number;
    model: string;
    markerTopPercent: number;
  };
}

export interface EvaluationBarInput {
  mode: EvaluationMode;
  stockfish: EngineScore | null;
  maia: MaiaPositionAnalysis | null;
}

export function humanWdlFromWhitePerspective(
  wdl: HumanWdl,
  sideToMove: "white" | "black",
): WhiteHumanWdl {
  const whiteWin = sideToMove === "white" ? wdl.win : wdl.loss;
  const blackWin = sideToMove === "white" ? wdl.loss : wdl.win;
  const percent = (value: number) => Math.round(value * 100_000_000) / 1_000_000;
  return {
    whiteWinPercent: percent(whiteWin),
    drawPercent: percent(wdl.draw),
    blackWinPercent: percent(blackWin),
    whiteExpectedPercent: percent(whiteWin + wdl.draw / 2),
  };
}

/** Converts source facts into orientation-only presentation.
 * Stockfish stays on the canonical WinPercent curve. Maia is human-game WDL,
 * converted from its explicit side-to-move perspective without centipawns. */
export function evaluationBarPresentation(
  input: EvaluationBarInput,
  orientation: BoardOrientation,
): EvaluationBarPresentation {
  const stockfishWhite = input.stockfish === null ? 50 : winPercentFromScore(input.stockfish);
  const maiaWhite = input.maia
    ? humanWdlFromWhitePerspective(input.maia.rootWdl, input.maia.sideToMove)
    : null;
  const whitePercent = input.mode === "maia"
    ? maiaWhite?.whiteExpectedPercent ?? 50
    : stockfishWhite;
  const blackPercent = 100 - whitePercent;
  const whiteAtBottom = orientation === "white";
  const topPercent = whiteAtBottom ? blackPercent : whitePercent;
  const sourceLabel = input.mode === "stockfish"
    ? "Stockfish objective evaluation"
    : input.mode === "maia"
      ? input.maia
        ? "Maia predicted human-game WDL"
        : "Maia prediction pending"
      : "Stockfish objective evaluation with Maia human marker";
  const maia = input.maia && maiaWhite
    ? {
        ...maiaWhite,
        sideToMove: input.maia.sideToMove,
        targetElo: input.maia.targetElo,
        model: input.maia.model,
        markerTopPercent: whiteAtBottom
          ? 100 - maiaWhite.whiteExpectedPercent
          : maiaWhite.whiteExpectedPercent,
      }
    : undefined;

  return {
    mode: input.mode,
    whitePercent,
    blackPercent,
    topColor: whiteAtBottom ? "black" : "white",
    topPercent,
    bottomColor: whiteAtBottom ? "white" : "black",
    bottomPercent: whiteAtBottom ? whitePercent : blackPercent,
    sourceLabel,
    ariaLabel: (maia
      ? sourceLabel + "; White win " + Math.round(maia.whiteWinPercent)
        + " percent, draw " + Math.round(maia.drawPercent)
        + " percent, Black win " + Math.round(maia.blackWinPercent)
        + " percent; " + maia.model + " at Elo " + maia.targetElo
      : sourceLabel + "; White winning chances " + Math.round(whitePercent) + " percent")
      + "; " + (whiteAtBottom ? "White" : "Black") + " at bottom",
    ...(maia === undefined ? {} : { maia }),
  };
}
