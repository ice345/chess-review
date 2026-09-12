import { describe, expect, it } from "vitest";
import { practicePresentation } from "./practice-presentation";

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
  });

  it("is a no-op when practice is idle", () => {
    expect(practicePresentation({ active: false, status: "solving" }).hideReviewChrome).toBe(false);
    expect(practicePresentation({ active: false, status: "solving" }).showEngineArrows).toBe(true);
  });
});
