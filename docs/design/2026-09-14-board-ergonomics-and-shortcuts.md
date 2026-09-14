# Board ergonomics and shortcuts

Date: 2026-09-14

Phase 1 of
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md):
the board becomes a user-controlled workspace, and the keyboard map stops being
undocumented.

## What changed

- `lib/review-shortcuts.ts` is the one shortcut table. The key handler
  (`hooks/use-review-keyboard-shortcuts.ts`), the `?` overlay
  (`components/review/shortcut-help.tsx`) and the Help page all read it, so a
  documented shortcut cannot be one that does nothing. Map: `←`/`J`, `→`/`K`,
  `↑`, `↓`, `Space`, `Esc`, `F`, `Z`, `?`.
- Shortcuts are ignored from form controls, links, buttons and sliders, ignore
  `Cmd`/`Ctrl`/`Alt` combinations, and the whole map is suspended while the
  promotion chooser or the shortcut overlay owns the keyboard.
- `Escape` now closes the promotion chooser (dialog behavior), leaves a temporary
  variation, and otherwise leaves Focus board. Before this pass only the variation
  case existed, inside `review-shell.tsx`.
- Board size: `lib/board-geometry.ts` bounds the control (320–720 px, 20 px step)
  and `hooks/use-board-geometry-preference.ts` owns the preference. The workspace
  applies it as `--review-board-preference`; CSS clamps it through
  `--review-board-max` so a stored `720px` can never push the context panel out of
  the viewport, and the responsive default applies below 901px, where the control
  is hidden entirely.
- Focus board: one session-only mode (`Z`, or the toolbar control). One column, no
  context panel, board bounded by the viewport, player strips, evaluation bar and
  transport kept.
- `review-shell.tsx` gained composition only: the geometry hook, the shortcut hook
  and two components. The key handling that used to live inline in the shell is
  gone.

## Decisions worth recording

**The control reports the rendered size, not the stored value.** The layout owns
the safe range, so a visitor on a 1000 px window asking for 720 px gets what the
viewport allows. The row therefore shows the width the board actually rendered at
(measured with a `ResizeObserver`), which means the slider can never claim a size
the layout refused.

**Persistence happens when the interaction ends, not per step.** Every settings
write dispatches `APP_SETTINGS_EVENT`, which re-runs the board-piece and sound
settings listeners; writing once per pixel of a drag would re-render the board
for values the visitor is still moving away from. The slider therefore persists on
`pointerup`, `keyup` and `blur`. An earlier debounced version lost the write when
the page was reloaded mid-drag, because an abrupt navigation does not run React
cleanup.

**The toolbar row is a stacking context.** `.board-player-header` carries a
`transform`, so the board-settings popover anchored inside it painted underneath
the board that follows in DOM order and its buttons could not be clicked. The row
now has `position: relative; z-index: 9` (above the board's own overlay layer) and
the reason is commented in `review-workspace.css`.

**No duplicate layout logic in JavaScript.** The clamp stays in CSS; the hook only
stores intent and reads back the rendered width. A JS mirror of the breakpoints
would have been the second source of truth.

## Verification

- `e2e/review-ergonomics.spec.ts`: keyboard navigation across the whole map, `F`
  flipping the board (a1 changes side of the board, not just square color), Space
  play/pause, `?` suspending the workspace, a focused slider keeping its arrow
  keys, `Esc` leaving a variation, the board-size preference surviving a reload
  and clearing back to automatic, the hidden control and no horizontal overflow at
  390 px, and Focus board hiding the panel, enlarging the board, exiting through
  `Esc` and the control, and never persisting.
- `lib/board-geometry.test.ts` and `lib/review-shortcuts.test.ts` cover the bounds
  and the key table, including that no key is bound twice.
- Visual baselines: the review screenshots differ by 0.23–0.38 % of pixels, all
  inside the toolbar row band (`y 113–156`), which is the row that gained the board
  settings and focus controls. Two consecutive renders of the unchanged code are
  byte-identical except for 72 pixels of antialiasing in the same row, so the
  residual noise is not attributable to this change.
