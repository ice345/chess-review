Status: Historical
Baseline: 2026-09-14 (refinement audit phase 2)
Superseded by: [docs/ui-spec.md](../ui-spec.md)
Do not use as the current product contract.

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
  what this session actually viewed, the most important mistake, the good move
  worth another look, one factual sentence about the game, the practice tally,
  the Training contribution for this game, and the handoff to Moves, Training and
  Study.
- `lib/review-session.ts` owns the session's own counts, and
  `lib/review-completion.ts` owns the teaching selection rules.
- Practice gained a **Hint** step and a single-moment entry point
  (`useRetrospect.startAt`). Results now distinguish *hinted* from *solved*.
  See [`mistake-practice.md`](../mistake-practice.md).

## Follow-up, 2026-09-15: the counts were not the session's

The first version summarised the review with `analysis.criticalMoments.length`,
which is a property of the analysis, not of the session. `Finish review early` on
the starting position therefore announced "5 key moments reviewed" with zero
visits. Three rules now apply.

**The headline counts the session.** `reviewSessionCounts` intersects the seen
plies with the moments of the current analysis, so the title reads `0 of 5 key
moments viewed` and the detail keeps the remaining work visible. Viewing is never
reported as learning: the practice tally is a separate line, and the full-browse
case says `All 5 key moments viewed` with an explicit statement that viewing is
not solving. A ply that a re-analysis no longer places there stops counting.

**A game with no key moment can still be finished.** The headline becomes `No key
moment crossed the thresholds` and the detail says so; no count is invented.

**Selection is a stated rule, not maximum Accuracy.** The highlight prefers
verified special good moves (Brilliant, then Critical, then Sacrifice) over
ordinary Best moves, then Accuracy, then the earlier ply — a Brilliant at 100 and
two Best moves at 100 no longer resolve by array order. The most important mistake
requires real error evidence: a costly quality band or a missed win/mate
annotation, with a positive canonical loss. A Critical good move with a 0.2-point
loss is not a mistake. Both facts are scoped to the learner when one is known, and
state the mover when the review covers both sides. The section is titled *Worth
another look* because it is a teaching choice, not a new quality grade.

**The Training count is a position count.** `trainingGameContribution` counts
distinct `gameId:ply` positions this game contributed and the tasks that hold
them, instead of counting queue items and calling them positions.

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
