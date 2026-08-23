import type { EngineScore } from "@chess-review/shared";
import { clamp } from "./math";

export const WIN_PERCENT_CP_CEILING = 1000;
export const INITIAL_CENTIPAWNS = 15;
export const WINNING_CHANCES_MULTIPLIER = -0.00368208;

export function winningChancesFromCentipawns(cp: number): number {
  const ceiled = clamp(cp, -WIN_PERCENT_CP_CEILING, WIN_PERCENT_CP_CEILING);
  return clamp(2 / (1 + Math.exp(WINNING_CHANCES_MULTIPLIER * ceiled)) - 1, -1, 1);
}

export function winPercentFromCentipawns(cp: number): number {
  return 50 + 50 * winningChancesFromCentipawns(cp);
}

export function winPercentFromScore(score: EngineScore): number {
  if (score.kind === "cp") return winPercentFromCentipawns(score.cp);
  const sign = score.mateIn >= 0 ? 1 : -1;
  return winPercentFromCentipawns(sign * WIN_PERCENT_CP_CEILING);
}
