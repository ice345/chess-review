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
  /** Analysis exports carry the answer for the position being solved. */
  hideAnalysisExports: boolean;
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
    hideAnalysisExports: owed,
  };
}

export function practiceAnswerOwed(status: RetroStatus): boolean {
  return ANSWER_OWED.includes(status);
}

/**
 * The ply whose analysis is withheld because the guided review offered it as a
 * blind attempt and the visitor has not answered it yet.
 *
 * Concealment is a weaker state than practice: it holds only while the board is on
 * that ply and no session is running, and any navigation retires it.
 */
export function concealedAnswerPly(input: { concealedPly: number | null; currentPly: number; practiceActive: boolean }): number | null {
  if (input.practiceActive || input.concealedPly === null) return null;
  return input.concealedPly === input.currentPly ? input.concealedPly : null;
}

/** The presentation for a withheld answer, derived from the practice policy. */
export function withheldPresentation(practice: PracticePresentation, concealed: boolean): PracticePresentation {
  if (!concealed) return practice;
  return {
    ...practice,
    showFaultArrow: false,
    showEngineArrows: false,
    showEvalValues: false,
    showMoveBadge: false,
    hideCoachAnswers: true,
    hideAnalysisExports: true,
  };
}
