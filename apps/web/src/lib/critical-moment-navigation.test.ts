import { describe, expect, it } from "vitest";
import type { CriticalMoment } from "@chess-review/shared";
import { allKeyMomentsVisited, criticalMomentPlies, keyMomentPosition, nextCriticalPly, previousCriticalPly } from "./critical-moment-navigation";

const moment = (ply: number): CriticalMoment => ({ ply, classification: "mistake", winPercentSwing: 8 });

const MOMENTS: CriticalMoment[] = [moment(8), moment(6), moment(14), moment(8), moment(20)];

describe("critical moment navigation", () => {
  it("orders and deduplicates the moment plies", () => {
    expect(criticalMomentPlies(MOMENTS)).toEqual([6, 8, 14, 20]);
  });

  it("reports the current position only when the board is on a moment", () => {
    expect(keyMomentPosition(MOMENTS, 8)).toEqual({ index: 2, total: 4 });
    expect(keyMomentPosition(MOMENTS, 6)).toEqual({ index: 1, total: 4 });
    expect(keyMomentPosition(MOMENTS, 7)).toBeNull();
    expect(keyMomentPosition(MOMENTS, 0)).toBeNull();
  });

  it("steps to the neighbouring moments from between moments", () => {
    expect(previousCriticalPly(MOMENTS, 7)).toBe(6);
    expect(nextCriticalPly(MOMENTS, 7)).toBe(8);
  });

  it("steps off a moment rather than staying on it", () => {
    expect(previousCriticalPly(MOMENTS, 8)).toBe(6);
    expect(nextCriticalPly(MOMENTS, 8)).toBe(14);
  });

  it("reports no neighbour at the ends instead of wrapping", () => {
    expect(previousCriticalPly(MOMENTS, 6)).toBeNull();
    expect(previousCriticalPly(MOMENTS, 1)).toBeNull();
    expect(nextCriticalPly(MOMENTS, 20)).toBeNull();
    expect(nextCriticalPly(MOMENTS, 99)).toBeNull();
  });

  it("treats an unanalyzed or empty moment list as nothing to guide", () => {
    expect(criticalMomentPlies([])).toEqual([]);
    expect(previousCriticalPly([], 5)).toBeNull();
    expect(nextCriticalPly([], 5)).toBeNull();
    expect(keyMomentPosition([], 0)).toBeNull();
    expect(allKeyMomentsVisited([], new Set())).toBe(false);
  });

  it("only completes once every moment has been visited", () => {
    expect(allKeyMomentsVisited(MOMENTS, new Set([6, 8, 14]))).toBe(false);
    expect(allKeyMomentsVisited(MOMENTS, new Set([6, 8, 14, 20]))).toBe(true);
    expect(allKeyMomentsVisited(MOMENTS, new Set([6, 8, 14, 20, 99]))).toBe(true);
  });
});
