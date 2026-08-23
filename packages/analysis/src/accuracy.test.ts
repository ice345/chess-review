import { describe, expect, it } from "vitest";
import { gameAccuracy, moveAccuracyFromWinPercents } from "./accuracy";
import { harmonicMean } from "./math";
import { winPercentFromCentipawns, winPercentFromScore } from "./win-percent";

describe("Lichess WinPercent port", () => {
  it("uses the selected scalachess curve and CP ceiling", () => {
    expect(winPercentFromCentipawns(0)).toBe(50);
    expect(winPercentFromCentipawns(1000)).toBeCloseTo(97.545, 3);
    expect(winPercentFromCentipawns(-1000)).toBeCloseTo(2.455, 3);
    expect(winPercentFromCentipawns(5000)).toBe(winPercentFromCentipawns(1000));
  });

  it("maps mate through the signed CP ceiling", () => {
    expect(winPercentFromScore({ kind: "mate", mateIn: 2 })).toBe(winPercentFromCentipawns(1000));
    expect(winPercentFromScore({ kind: "mate", mateIn: -2 })).toBe(winPercentFromCentipawns(-1000));
  });
});

describe("Lichess AccuracyPercent port", () => {
  it("gives 100 when winning chances do not decrease", () => {
    expect(moveAccuracyFromWinPercents(45, 46)).toBe(100);
  });

  it("includes the upstream uncertainty bonus", () => {
    expect(moveAccuracyFromWinPercents(60, 50)).toBeCloseTo(64.5798284537, 8);
  });

  it("matches upstream short-game behavior", () => {
    expect(gameAccuracy("white", [])).toBeNull();
    expect(gameAccuracy("white", [15])).toBeNull();
    const result = gameAccuracy("white", [15, 15]);
    expect(result?.white).toBeCloseTo(100, 8);
    expect(result?.black).toBeCloseTo(100, 8);
  });

  it("weights volatility and combines weighted and harmonic means", () => {
    const result = gameAccuracy("white", [...Array<number>(20).fill(15), -900]);
    expect(result?.white).toBeGreaterThan(45);
    expect(result?.white).toBeLessThan(55);
    expect(result?.black).toBeCloseTo(100, 6);
  });

  it("supports games starting with Black", () => {
    const result = gameAccuracy("black", [900, 900]);
    expect(result?.black).toBeLessThan(15);
    expect(result?.white).toBeCloseTo(100, 6);
  });

  it("matches scalalib's harmonic floor for zero-accuracy moves", () => {
    expect(harmonicMean([0, 100])).toBeCloseTo(1.9801980198, 8);
  });
});
