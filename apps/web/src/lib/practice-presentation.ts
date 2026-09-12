export type RetroStatus =
  | "solving"
  | "evaluating"
  | "rejected"
  | "rewinding"
  | "accepted"
  | "revealed"
  | "complete";


/**
 * One derived view of an in-place practice session. Review chrome, arrows,
 * eval numbers and coach answers all read this instead of each guessing
 * `active` / `locked` on their own. It does not recompute chess analysis.
 */
export interface PracticePresentation {
  hideReviewChrome: boolean;
  showFaultArrow: boolean;
  showEngineArrows: boolean;
  showEvalValues: boolean;
  showMoveBadge: boolean;
  hideCoachAnswers: boolean;
}

const ANSWER_OWED: readonly RetroStatus[] = ["solving", "evaluating", "rejected", "rewinding"];
const PROMPT_POSITION: readonly RetroStatus[] = ["solving", "rewinding"];

export function practicePresentation(input: { active: boolean; status: RetroStatus }): PracticePresentation {
  const owed = input.active && ANSWER_OWED.includes(input.status);
  return {
    hideReviewChrome: input.active,
    // The attempt has already left the prompt FEN during evaluating/rejected.
    showFaultArrow: input.active && PROMPT_POSITION.includes(input.status),
    showEngineArrows: !owed,
    showEvalValues: !owed,
    showMoveBadge: !owed,
    hideCoachAnswers: owed,
  };
}

export function practiceAnswerOwed(status: RetroStatus): boolean {
  return ANSWER_OWED.includes(status);
}
