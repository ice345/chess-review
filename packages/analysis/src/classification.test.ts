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
    expect(result.quality).toBe("best");
    expect(result.annotations).toContain("critical");
    expect(result.reason).toMatchObject({ isEngineBest: true, secondBestGapCp: 200, precedenceRule: "outcome-critical-best-move" });
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
      secondBestScore: { kind: "cp", cp: -100 },
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
    expect(result.quality).toBe("best");
    expect(result.annotations).toEqual(expect.arrayContaining(["critical", "sacrifice", "brilliant"]));
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
    expect(result.annotations).toContain("missed_mate");
    expect(result.reason.centipawnLoss).toBeUndefined();
  });

  it("calls an exactly tied move best even when MultiPV ranked it second", () => {
    // Two moves share the top evaluation; only one of them can be rank 1.
    // The player's choice preserved the evaluation, so it is the engine's best.
    const result = classifyMove({
      ...base,
      scoreBefore: { kind: "cp", cp: 120 },
      scoreAfter: { kind: "cp", cp: 120 },
      playedMoveRank: 2,
    });
    expect(result.reason).toMatchObject({ centipawnLoss: 0, winPercentLoss: 0 });
    expect(result.quality).toBe("best");
    expect(result.classification).toBe("best");
    expect(result.reason.isEngineBest).toBe(true);
  });

  it("does not promote a saturated-evaluation blunder to best", () => {
    // WinPercent saturates in a decided position, so this move shows zero
    // win-percent loss while being 100 centipawns worse. Only the centipawn
    // guard keeps it out of "best".
    const result = classifyMove({
      ...base,
      scoreBefore: { kind: "cp", cp: 1_200 },
      scoreAfter: { kind: "cp", cp: 1_100 },
      playedMoveRank: 2,
    });
    expect(result.reason).toMatchObject({ centipawnLoss: 100, winPercentLoss: 0 });
    expect(result.quality).toBe("excellent");
    expect(result.classification).not.toBe("best");
  });

  it("does not call an ordinary near-equal rank-three move Interesting", () => {
    const result = classifyMove({
      ...base,
      scoreBefore: { kind: "cp", cp: 32 },
      scoreAfter: { kind: "cp", cp: 8 },
      playedMoveRank: 3,
    });
    expect(result.quality).toBe("good");
    expect(result.classification).toBe("good");
    expect(result.annotations).not.toContain("critical");
  });

  it("never invents a rank for an outside-MultiPV move", () => {
    const { playedMoveRank: _rank, ...outsideBase } = base;
    const result = classifyMove({
      ...outsideBase,
      scoreBefore: { kind: "cp", cp: 32 },
      scoreAfter: { kind: "cp", cp: 8 },
      playedMoveOutsideMultiPv: true,
    });
    expect(result.classification).toBe("good");
    expect(result.reason.engineRank).toBeUndefined();
    expect(result.reason.playedMoveOutsideMultiPv).toBe(true);
  });

  it("cannot emit an ordinary error when saturated WinPercent loss is zero", () => {
    const result = classifyMove({
      ...base,
      scoreBefore: { kind: "cp", cp: 1_200 },
      scoreAfter: { kind: "cp", cp: 1_100 },
      playedMoveRank: 2,
    });
    expect(result.reason).toMatchObject({ centipawnLoss: 100, winPercentLoss: 0 });
    expect(result.quality).toBe("excellent");
    expect(["inaccuracy", "mistake", "blunder"]).not.toContain(result.classification);
  });

  it("does not make a decided-position CP gap Critical when outcomes are equal", () => {
    const result = classifyMove({
      ...base,
      scoreBefore: { kind: "cp", cp: 1_200 },
      scoreAfter: { kind: "cp", cp: 1_200 },
      secondBestScore: { kind: "cp", cp: 1_000 },
    });
    expect(result.classification).toBe("best");
    expect(result.reason.secondBestGapCp).toBe(200);
    expect(result.reason.secondBestGapWinPercent).toBe(0);
  });

  it("keeps tied MultiPV lines non-critical", () => {
    const result = classifyMove({ ...base, secondBestScore: base.scoreBefore });
    expect(result.quality).toBe("best");
    expect(result.annotations).not.toContain("critical");
  });

  it("keeps forced, recapture and trivial-escape semantics out of Critical", () => {
    const secondBestScore = { kind: "cp" as const, cp: -200 };
    expect(classifyMove({ ...base, legalMoveCount: 1, secondBestScore }).annotations).not.toContain("critical");
    expect(classifyMove({ ...base, secondBestScore, isObviousRecapture: true }).annotations).not.toContain("critical");
    expect(classifyMove({ ...base, secondBestScore, isTrivialCheckEscape: true }).annotations).not.toContain("critical");
  });

  it("retains a sound sacrifice annotation but requires a meaningful alternative gap for Brilliant", () => {
    const result = classifyMove({
      ...base,
      secondBestScore: { kind: "cp", cp: 95 },
      sacrifice: {
        sacrificedMaterial: 300,
        see: -300,
        compensationCp: 320,
        survivesBestResponse: true,
        recoveredWithinPv: 0,
        genuine: true,
      },
    });
    expect(result.annotations).toContain("sacrifice");
    expect(result.annotations).not.toContain("brilliant");
    expect(result.classification).toBe("best");
  });

  it("is symmetric for equivalent White and Black mover evidence", () => {
    const white = classifyMove({ ...base, scoreBefore: { kind: "cp", cp: 200 }, scoreAfter: { kind: "cp", cp: 0 }, playedMoveRank: 2 });
    const black = classifyMove({ ...base, color: "black", scoreBefore: { kind: "cp", cp: -200 }, scoreAfter: { kind: "cp", cp: 0 }, playedMoveRank: 2 });
    expect(black.quality).toBe(white.quality);
    expect(black.reason.winPercentLoss).toBeCloseTo(white.reason.winPercentLoss, 10);
  });

  it("keeps mate-retained and mate-lost outcomes distinct", () => {
    expect(classifyMove({ ...base, scoreBefore: { kind: "mate", mateIn: 4 }, scoreAfter: { kind: "mate", mateIn: 7 } }).annotations).not.toContain("missed_mate");
    expect(classifyMove({ ...base, scoreBefore: { kind: "mate", mateIn: 4 }, scoreAfter: { kind: "cp", cp: 900 }, playedMoveRank: 2 }).annotations).toContain("missed_mate");
    expect(classifyMove({ ...base, scoreBefore: { kind: "mate", mateIn: 4 }, scoreAfter: { kind: "cp", cp: 0 }, playedMoveRank: 2 }).quality).toBe("blunder");
  });

  it("carries explicit low-depth verification evidence without changing the quality formula", () => {
    const result = classifyMove({
      ...base,
      verification: { status: "baseline", depth: 10, multiPv: 3, reasons: ["low-depth-evidence"] },
    });
    expect(result.reason.verification).toMatchObject({ status: "baseline", reasons: ["low-depth-evidence"] });
    expect(result.quality).toBe("best");
  });

  it("suppresses consequential annotations when a final build could not verify them", () => {
    const result = classifyMove({
      ...base,
      secondBestScore: { kind: "cp", cp: -400 },
      specialAnnotationsVerified: false,
    });
    expect(result).toMatchObject({ quality: "best", annotations: [], classification: "best" });
    expect(result.reason.exclusions).toContain("special-annotation-not-verified");
  });
});
