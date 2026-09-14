# Guided review

Date: 2026-09-14

Phase 2 of
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md):
Review stops being a workspace the visitor has to interpret and starts telling
them where they are, what the next important decision is, and when they are
finished — without removing any of the free exploration the workspace already
had.

## What changed

- `lib/critical-moment-navigation.ts` answers where the visitor is among the
  canonical critical moments and what the neighbouring moment is. It never decides
  which moves matter; the analysis already did that.
- `components/review/key-moment-navigation.tsx` renders the guided strip in the
  Review panel: *Previous key moment* / `Moment n of m` / *Next key moment*, the
  `Try again` action for the moment the board is on, and the finish action.
- `components/review/review-completion.tsx` renders the end state:
  the most important mistake, the best moment, one factual sentence about the
  game, the session tally, the Training count for this game, and the handoff to
  Moves, Training and Study.
- `lib/review-completion.ts` derives those facts from the canonical analysis
  only: the largest positive `winPercentSwing` among the key moments, the
  best-classified move with the highest Accuracy, and the visitor's lowest-scoring
  scored phase.
- Practice gained a **Hint** step and a single-moment entry point
  (`useRetrospect.startAt`). Results now distinguish *hinted* from *solved*.
  See [`mistake-practice.md`](../mistake-practice.md).

## Decisions worth recording

**Guided review never traps the visitor.** Every move stays clickable, the
progress strip is an indicator rather than a wizard, and the completion state is
reachable at any time ("Finish review early") and reversible ("Back to key
moments"). The audit's requirement was guidance, not a flow lock.

**The completion state publishes facts, not assertions.** No phase claim is made
for a game that never left the opening structurally, and no claim is made at all
when the review has no known side, because `division.middlePly` and
`preferredOrientation` are the only evidence for it. A vision of "one sentence
game lesson" that invented a cause would have violated the evidence contract.

**A hint can never become a solve.** `recordResult` keeps the first result for a
position, so a hinted position stays hinted after the visitor finds the move or
views the solution, and the completion panel says so explicitly. Hinting reveals
the origin square of the strongest move and nothing else — the destination stays
hidden, which is what keeps the exercise a search rather than a copy.

**Guided retry reuses the practice queue's own eligibility rule.** The
"Try again" action asks `practiceMoves()` from `@chess-review/analysis` instead of
re-implementing "is this moment practisable", so a guided moment can never offer a
position the full exercise would exclude (opening theory, missing engine
evidence).

**The moment's facts stay on the fault ply.** `startAt` builds the retrospective
from the fault move and sets a one-position queue, so the prompt position, the
engine alternative and the recorded result all belong to the same ply — the same
identity rule the full exercise uses.

## Verification

- `lib/critical-moment-navigation.test.ts` and `lib/review-completion.test.ts`
  cover ordering, deduplication, both boundaries, the no-neighbour cases, and the
  choice of mistake, best moment and phase sentence.
- `e2e/guided-review.spec.ts` drives the real workspace: the progress strip before
  and on a moment, direct navigation not being blocked, `Try again` starting a
  1/1 session, the hint marking the origin square with the brass ring while the
  answer stays hidden, the solution reveal, and the completion state — including
  that a hinted position is reported as hinted and never as solved.
- Visual baselines were inspected before being refreshed. The seeded visual
  fixture has no critical moment, so the guided strip renders nothing there: the
  only differences are a 0.28 % text-antialiasing band in one combined-mode
  screenshot and a 72-pixel band that reproduces between two renders of unchanged
  code. Crops of the changed bands were compared and show no layout or content
  change.
