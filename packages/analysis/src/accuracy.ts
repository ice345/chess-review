import type { EngineScore, GameDivision, GamePhase, PlayerColor } from "@chess-review/shared";
import { clamp, harmonicMean, standardDeviation, weightedMean } from "./math";
import { INITIAL_CENTIPAWNS, winPercentFromCentipawns } from "./win-percent";
import { phaseForPly } from "./divider";

export interface ColorAccuracy {
  white: number;
  black: number;
}

export interface PhaseEvaluation {
  ply: number;
  color: PlayerColor;
  centipawns: number | null;
}

/** Lila forceAsCp is subsequently clamped by WinPercent; the signed ceiling is equivalent here. */
export function scoreToAccuracyCentipawns(score: EngineScore): number {
  if (score.kind === "cp") return score.cp;
  return score.mateIn >= 0 ? 1000 : -1000;
}

export function moveAccuracyFromWinPercents(before: number, after: number): number {
  if (after >= before) return 100;
  const winDiff = before - after;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) - 3.166924740191411;
  return clamp(raw + 1, 0, 100);
}

function colorAt(index: number, startColor: PlayerColor): PlayerColor {
  if (index % 2 === 0) return startColor;
  return startColor === "white" ? "black" : "white";
}

function slidingWindows<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [];
  if (values.length <= size) return [values.slice()];
  const result: T[][] = [];
  for (let start = 0; start + size <= values.length; start += 1) {
    result.push(values.slice(start, start + size));
  }
  return result;
}

/** Behavior-level port of lila AccuracyPercent.gameAccuracy. */
export function gameAccuracy(
  startColor: PlayerColor,
  centipawnsAfterEachPly: Array<number | null>,
): ColorAccuracy | null {
  const allWinPercents: Array<number | null> = [
    winPercentFromCentipawns(INITIAL_CENTIPAWNS),
    ...centipawnsAfterEachPly.map((cp) => (cp === null ? null : winPercentFromCentipawns(cp))),
  ];
  const windowSize = clamp(Math.floor(centipawnsAfterEachPly.length / 10), 2, 8);
  const prefixCount = Math.min(windowSize, allWinPercents.length) - 2;
  const windows: Array<Array<number | null>> = [];
  for (let index = 0; index < prefixCount; index += 1) {
    windows.push(allWinPercents.slice(0, windowSize));
  }
  windows.push(...slidingWindows(allWinPercents, windowSize));

  const weights = windows.map((window) => {
    if (window.some((value) => value === null)) return null;
    const deviation = standardDeviation(window as number[]);
    return deviation === null ? null : clamp(deviation, 0.5, 12);
  });

  const byColor: Record<PlayerColor, Array<readonly [number, number]>> = {
    white: [],
    black: [],
  };

  for (let index = 0; index + 1 < allWinPercents.length; index += 1) {
    const previous = allWinPercents[index];
    const next = allWinPercents[index + 1];
    const weight = weights[index];
    if (
      previous === null
      || previous === undefined
      || next === null
      || next === undefined
      || weight === null
      || weight === undefined
    ) continue;
    const color = colorAt(index, startColor);
    const accuracy = color === "white"
      ? moveAccuracyFromWinPercents(previous, next)
      : moveAccuracyFromWinPercents(next, previous);
    byColor[color].push([accuracy, weight]);
  }

  const colorAccuracy = (color: PlayerColor): number | null => {
    const samples = byColor[color];
    const weighted = weightedMean(samples);
    const harmonic = harmonicMean(samples.map((sample) => sample[0]));
    return weighted === null || harmonic === null ? null : (weighted + harmonic) / 2;
  };

  const white = colorAccuracy("white");
  const black = colorAccuracy("black");
  return white === null || black === null ? null : { white, black };
}

/** Phase slices deliberately reuse gameAccuracy, matching current Lichess behavior. */
export function phaseAccuracies(
  division: GameDivision,
  evaluations: PhaseEvaluation[],
): { white: Partial<Record<GamePhase, number>>; black: Partial<Record<GamePhase, number>> } {
  const result: { white: Partial<Record<GamePhase, number>>; black: Partial<Record<GamePhase, number>> } = {
    white: {},
    black: {},
  };
  if (division.middlePly === undefined) return result;

  for (const phase of ["opening", "middlegame", "endgame"] as const) {
    const slice = evaluations.filter((entry) => phaseForPly(entry.ply, division) === phase);
    const first = slice[0];
    if (!first) continue;
    const accuracy = gameAccuracy(first.color, slice.map((entry) => entry.centipawns));
    if (!accuracy) continue;
    result.white[phase] = accuracy.white;
    result.black[phase] = accuracy.black;
  }
  return result;
}
