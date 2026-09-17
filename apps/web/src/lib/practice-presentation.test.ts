import { describe, expect, it } from "vitest";
import { concealedAnswerPly, practicePresentation, withheldPresentation } from "./practice-presentation";

describe("practicePresentation", () => {
  it("hides review chrome and engine arrows while an answer is owed", () => {
    const solving = practicePresentation({ active: true, status: "solving" });
    expect(solving).toMatchObject({
      hideReviewChrome: true,
      showFaultArrow: true,
      showEngineArrows: false,
      showEvalValues: false,
      showMoveBadge: false,
      hideCoachAnswers: true,
      hideAnalysisExports: true,
    });
    expect(practicePresentation({ active: true, status: "rewinding" }).showFaultArrow).toBe(true);
    expect(practicePresentation({ active: true, status: "evaluating" }).showFaultArrow).toBe(false);
    expect(practicePresentation({ active: true, status: "rejected" }).showFaultArrow).toBe(false);
  });

  it("restores analysis chrome after a correct move without hiding the session", () => {
    const accepted = practicePresentation({ active: true, status: "accepted" });
    expect(accepted.hideReviewChrome).toBe(true);
    expect(accepted.showFaultArrow).toBe(false);
    expect(accepted.showEngineArrows).toBe(true);
    expect(accepted.showEvalValues).toBe(true);
    expect(accepted.hideAnalysisExports).toBe(false);
  });

  it("is a no-op when practice is idle", () => {
    expect(practicePresentation({ active: false, status: "solving" }).hideReviewChrome).toBe(false);
    expect(practicePresentation({ active: false, status: "solving" }).showEngineArrows).toBe(true);
    expect(practicePresentation({ active: false, status: "solving" }).hideAnalysisExports).toBe(false);
  });
});

describe("withheld answers", () => {
  it("conceals only the ply the guided review offered, and only while it is on the board", () => {
    expect(concealedAnswerPly({ concealedPly: 7, currentPly: 7, practiceActive: false })).toBe(7);
    expect(concealedAnswerPly({ concealedPly: 7, currentPly: 9, practiceActive: false })).toBeNull();
    expect(concealedAnswerPly({ concealedPly: 7, currentPly: 7, practiceActive: true })).toBeNull();
    expect(concealedAnswerPly({ concealedPly: null, currentPly: 7, practiceActive: false })).toBeNull();
  });

  it("hides the same evidence practice hides, without claiming a session", () => {
    const idle = practicePresentation({ active: false, status: "solving" });

    expect(withheldPresentation(idle, false)).toBe(idle);
    expect(withheldPresentation(idle, true)).toMatchObject({
      hideReviewChrome: false,
      showFaultArrow: false,
      showEngineArrows: false,
      showEvalValues: false,
      showMoveBadge: false,
      hideCoachAnswers: true,
      hideAnalysisExports: true,
    });
  });
});
