import { describe, expect, it } from "vitest";
import { classifyMove } from "./classification";

const base = {
  color: "white" as const,
  scoreBefore: { kind: "cp" as const, cp: 100 },
  scoreAfter: { kind: "cp" as const, cp: 100 },
  playedMoveRank: 1,
  legalMoveCount: 24,
  isBook: false,
  isCheckmate: false,
};

describe("explainable move classification", () => {
  it("marks a critical top move Great using MultiPV evidence", () => {
    const result = classifyMove({ ...base, secondBestScore: { kind: "cp", cp: -100 } });
    expect(result.classification).toBe("great");
    expect(result.reason).toMatchObject({ isEngineBest: true, secondBestGapCp: 200, precedenceRule: "critical-best-move" });
  });

  it("excludes obvious recaptures from Great", () => {
    const result = classifyMove({
      ...base,
      secondBestScore: { kind: "cp", cp: -100 },
      isObviousRecapture: true,
    });
    expect(result.classification).toBe("best");
    expect(result.reason.exclusions).toContain("obvious-recapture");
  });

  it("requires verified sacrifice evidence for Brilliant", () => {
    const result = classifyMove({
      ...base,
      sacrifice: {
        sacrificedMaterial: 300,
        see: -250,
        compensationCp: 320,
        survivesBestResponse: true,
        recoveredWithinPv: 0,
        genuine: true,
      },
    });
    expect(result.classification).toBe("brilliant");
    expect(result.reason.precedenceRule).toBe("verified-nontrivial-sacrifice");
  });

  it("reports a lost forced mate before the ordinary loss ladder", () => {
    const result = classifyMove({
      ...base,
      scoreBefore: { kind: "mate", mateIn: 3 },
      scoreAfter: { kind: "cp", cp: 400 },
      playedMoveRank: 2,
    });
    expect(result.classification).toBe("missed_mate");
    expect(result.reason.centipawnLoss).toBeUndefined();
  });
});
