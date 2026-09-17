---
name: visual-acceptance
description: >
  Validate meaningful UI, CSS, layout, typography, chess-board,
  chess-piece, responsive, or visual-system changes against the
  Windowlight production design and Playwright visual fixtures.
---

# Visual Acceptance

Use this workflow after meaningful visual frontend changes.

## 1. Establish scope

Inspect the final diff and identify which routes, components and viewports
could actually have changed.

Do not rerun the entire visual suite when a narrow fixture proves the change.

## 2. Read the contract

Read:

`docs/design/windowlight-contract.md`

Also inspect the relevant existing component and styles before judging the
result.

## 3. Verify functionality first

A visually attractive broken UI does not pass.

Run the narrowest relevant functional or component checks first.

## 4. Inspect a real rendered state

Use the actual application or the existing Playwright acceptance fixture.

For piece / board work, inspect:

`/design/pieces`

For general affected UI, inspect the actual affected route.

Do not evaluate visual work from CSS source alone.

## 5. Check visual invariants

Verify:

- hierarchy
- board prominence
- spacing and negative space
- typography
- contrast
- surface weight
- shadow weight
- border density
- motion
- responsive behavior
- semantic-color preservation

Check for accidental overflow.

## 6. Run relevant visual regression

Prefer targeted Playwright execution.

Examples:

`pnpm exec playwright test e2e/piece-fixture.spec.ts`

or the relevant portion of:

`pnpm exec playwright test e2e/visual.spec.ts`

Do not run snapshot update mode as the first response to a mismatch.

## 7. Handle screenshot differences

If a screenshot differs:

1. inspect the actual difference;
2. determine whether it is intended;
3. compare it against the Windowlight contract;
4. fix regressions;
5. only update the baseline after the new rendering has been accepted.

A passing regenerated baseline is not proof of correctness.

## 8. Final check

Inspect the final diff.

Report:

- visual states inspected;
- tests actually run;
- baselines intentionally updated, if any;
- remaining visual limitations.

Do not claim browser or screenshot verification that was not actually performed.
