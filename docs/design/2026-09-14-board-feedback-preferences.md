# Board feedback preferences

Date: 2026-09-14

Phase 3 of
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md):
a small, curated set of board-feedback controls, plus the "Key moves only"
emphasis that makes the move list calmer without losing anything.

## What changed

- Settings lists five new preferences under *Board and display*: coordinates
  (inside / off), analysis arrows, Move Quality badge, piece animation
  (off / fast / natural) and move-list emphasis (key / all). `AppSettings` gained
  the matching fields, `loadAppSettings` validates them against their option lists
  with the documented fallbacks, and `backupSettings` round-trips them, so an
  older backup restores the defaults and an unusable stored value cannot break the
  board.
- `hooks/use-board-display-settings.ts` applies them and subscribes to
  `APP_SETTINGS_EVENT`. The review shell still reads its analysis settings once at
  mount: depth and MultiPV changes must not churn a runtime that owns an in-flight
  engine request, while a display change must apply immediately.
- Piece animation is limited to Off (0 ms), Fast (90 ms) and Natural (160 ms) —
  the audit's window — through `PIECE_ANIMATION_MS`. No bounce, spring or glow was
  added anywhere.
- The Moves route filter now reads *All | Key | Errors* while keeping the internal
  value `critical`, and the list draws a non-key row with a quiet treatment
  (`[data-emphasis="quiet"]`) instead of hiding it. Emphasis and the *Key* filter
  read the same set — the canonical critical moments — so they cannot disagree.

## Decisions worth recording

**Analysis arrows and practice feedback are separate.** The arrow preference
controls the Stockfish and Maia candidates only. The red arrow that marks the
original mistake during practice is feedback about the attempt, not an analysis
overlay, so turning analysis arrows off must not blind the exercise.

**Emphasis is a treatment, not a filter.** The audit's requirement was to reduce
simultaneous colour rather than to delete data, so a quiet row keeps its icon,
its label and its Accuracy figure and only steps back to the faint ink. The
`data-emphasis` attribute makes the state assertable instead of implied by a
computed colour.

**One row height for setting controls.** The checkbox rows now use a shared
`setting-row` class with a 44 px minimum height, which is the UI audit's F6 fix
(the click target is the row; the visual box stays small). The rule was
introduced here because these are the rows that needed it.

## Verification

- `app-settings.test.ts` covers the documented defaults, an explicit off/on round
  trip, an unusable stored value falling back, and a library-backup round trip
  including the "older backup restores defaults" case.
- `e2e/board-preferences.spec.ts` asserts each preference on the real board:
  notation present then absent, arrows drawn then zero, the badge shown then gone,
  the preferences surviving a reload and being restorable, the quiet emphasis
  covering every non-key row while every row keeps its Accuracy, and the
  All/Key/Errors filter names with the Key filter narrowing the list to the one
  canonical moment.
