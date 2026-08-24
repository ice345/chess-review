import { describe, expect, it } from "vitest";
import { winPercentFromScore } from "@chess-review/analysis";
import { evaluationBarPresentation } from "./evaluation-bar";

describe("evaluationBarPresentation", () => {
  it("reuses the canonical WinPercent curve for centipawn scores", () => {
    const score = { kind: "cp", cp: 420 } as const;
    expect(evaluationBarPresentation(score, "white").whitePercent)
      .toBe(winPercentFromScore(score));
  });

  it("reuses canonical mate conversion instead of presenting an invented 100%", () => {
    const score = { kind: "mate", mateIn: 3 } as const;
    const presentation = evaluationBarPresentation(score, "white");
    expect(presentation.whitePercent).toBe(winPercentFromScore(score));
    expect(presentation.whitePercent).toBeLessThan(100);
  });

  it("flips only top/bottom presentation with board orientation", () => {
    const score = { kind: "cp", cp: 180 } as const;
    const white = evaluationBarPresentation(score, "white");
    const black = evaluationBarPresentation(score, "black");

    expect(white.whitePercent).toBe(black.whitePercent);
    expect(white.topColor).toBe("black");
    expect(white.bottomColor).toBe("white");
    expect(black.topColor).toBe("white");
    expect(black.bottomColor).toBe("black");
    expect(black.topPercent).toBe(white.bottomPercent);
  });

  it("uses an even neutral bar when no engine score exists", () => {
    expect(evaluationBarPresentation(null, "black")).toMatchObject({
      whitePercent: 50,
      blackPercent: 50,
      topPercent: 50,
      bottomPercent: 50,
    });
  });
});
