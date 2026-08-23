import { describe, expect, it } from "vitest";
import { humanFindDifficulty } from "./human-difficulty";

const base = {
  legalMoveCount: 24,
  isEngineBest: true,
  isForced: false,
  isForcing: false,
  isSacrifice: false,
  tacticalMotifCount: 0,
};

describe("experimental Human Find Difficulty", () => {
  it("labels a two-percent critical move Very Hard without changing objective quality", () => {
    const result = humanFindDifficulty({
      ...base,
      playedMoveProbability: 0.02,
      secondBestGapCp: 180,
    });

    expect(result.label).toBe("very-hard");
    expect(result.score).toBe(77);
    expect(result.evidence.adjustments).toContainEqual({ factor: "critical-objective-gap", points: 7 });
  });

  it("labels common forcing moves Natural", () => {
    const result = humanFindDifficulty({
      ...base,
      playedMoveProbability: 0.38,
      isForcing: true,
    });

    expect(result).toMatchObject({ label: "natural", score: 6 });
  });

  it("combines very rare policy, sacrifice and tactical evidence as Exceptional", () => {
    const result = humanFindDifficulty({
      ...base,
      playedMoveProbability: 0.01,
      isSacrifice: true,
      tacticalMotifCount: 2,
    });

    expect(result.label).toBe("exceptional");
    expect(result.score).toBe(100);
    expect(result.evidence.experimental).toBe(true);
  });

  it("treats the only legal move as Natural regardless of policy calibration", () => {
    const result = humanFindDifficulty({
      ...base,
      playedMoveProbability: 0.001,
      legalMoveCount: 1,
      isForced: true,
    });

    expect(result.label).toBe("natural");
    expect(result.score).toBe(5);
    expect(result.evidence.adjustments).toEqual([{ factor: "only-legal-move", points: -83 }]);
  });

  it("does not apply a top-two critical gap to a move that was not engine best", () => {
    const result = humanFindDifficulty({
      ...base,
      playedMoveProbability: 0.15,
      secondBestGapCp: 300,
      isEngineBest: false,
    });

    expect(result.score).toBe(30);
    expect(result.evidence.adjustments).not.toContainEqual({ factor: "critical-objective-gap", points: 7 });
  });

  it("rejects invalid probabilities instead of silently normalizing them", () => {
    expect(() => humanFindDifficulty({ ...base, playedMoveProbability: 1.2 })).toThrow(RangeError);
  });
});
