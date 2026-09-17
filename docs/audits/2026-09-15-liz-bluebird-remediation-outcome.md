Status: Historical
Baseline: `56d5af3` · 2026-09-15
Superseded by: none — kept as a record of a completed pass
Do not use as the current product contract.

# Liz Bluebird audit: remediation outcome

Date: 2026-09-15

Baseline: `56d5af34e82f89a0652899c54dfe737331009736` (= the audit's own baseline).
This records what the remediation pass changed, the evidence that it works, and
what remains outstanding. The findings themselves live in
[`2026-09-15-liz-bluebird-product-audit-and-remediation.md`](2026-09-15-liz-bluebird-product-audit-and-remediation.md);
this file does not restate them.

## Batch A — facts and state credibility

| Item | Change |
| --- | --- |
| C01 | Opera Game evaluation investigated and written up in [`2026-09-15-c01-opera-evaluation-investigation.md`](2026-09-15-c01-opera-evaluation-investigation.md); `scripts/diagnose-objective-game.mjs` reproduces the profile. No algorithm change was warranted by the evidence. |
| C02 | Early finish reports the moments actually reviewed; it no longer claims the full review was completed. Session progress moved into a stable store (see U02). |
| C03 | `lib/review-completion.ts` selects completion material by a stated rule instead of by list order. |
| C04 | Deterministic coach counts and copy built from canonical facts (`packages/analysis/src/coach-facts.ts`), including `tacticalIdea` wording that names only the motif this build detects. |
| C05 | Phase metrics name their population and aggregation, with missing data distinguished from zero. |
| C06 | `useWithheldPly()` hoisted above the early return in the Objective panel, and `react-hooks` lint rules enabled so the class of bug is caught, not just this instance. The new rule immediately caught one more instance during this pass. |
| A03 | Key-moment icons carry the moment's own annotation rather than a blanket *Critical*. |
| U07 | Completion reports task and position counts separately, and plans the Training handoff instead of counting queue items. |
| P02 | Tactical copy states the motif that was detected and says when this build did not detect one. |

## Batch B — review learning task

U01, U03, U04, U05 and P03 changed what Review and Study say first, made a
withheld answer a real state, replaced rule identifiers with evidence in words,
gave Study a usable first action, and unified the learner identity across
surfaces. The design record is
[`../design/2026-09-15-review-desk-and-withheld-answers.md`](../design/2026-09-15-review-desk-and-withheld-answers.md).

U02 moved guided progress (`visited`, `finished`, attempts, exposure) into
`lib/review-session.ts` keyed by game identity and objective version, so a route
change or a remount cannot lose the session's own record.

## Batch C — long-term training loop

- U06: Training opens with today's task, its reason, its recorded progress and one
  primary action, before the report and the queue. `?player=` and `?task=` carry
  the end-of-review handoff, and the block says when the visitor arrived from it.
  While the data is still being read it says so, and data that could not be read
  is reported as unreadable rather than offered as "nothing to train" — the same
  rule R02 states for the rest of local data — with the block's own **Try again**
  so a retry cannot leave it disagreeing with the list below. See
  [`../advanced-study.md`](../advanced-study.md).
- P01: the Opening Explorer has explicit, distinguishable states (loading, fresh,
  stale, empty, offline, rate-limited, failed) with a panel-local retry, a discard
  rule for superseded answers, and database/population/sample/FEN context beside
  its numbers. Recorded in
  [`../design/2026-09-14-opening-explorer.md`](../design/2026-09-14-opening-explorer.md).

## Batch D — accessibility and visual polish

- **A01**: the functional small-text tokens were re-derived from measured
  contrast ratios; `lib/contrast.test.ts` computes the pairs and fails below the
  thresholds. The measured pairs are recorded in the token file.
- **A02**: the board is operable and legible without a pointer. `MoveEntry` takes
  SAN or UCI, validated by `resolveMoveInput` in `packages/chess-core`, and routes
  the move through the board's own `playBoardMove`. Squares are named groups, every
  piece carries its own name and square, the position is available as a FEN, and
  each move is announced politely. Details, and the deliberate decision not to make
  the squares focusable, are in the design record.
- **V01**: a spacing scale (`--space-section` / `--space-block` / `--space-row`,
  plus `--measure-prose`) joined the type scale in `tokens.css`, and the review
  surfaces touched by this pass use it. An inspection of Review, Training and
  Settings found no decorative paper nesting: the surfaces are controls, cards and
  overlays.
- **V02**: the piece-legibility acceptance protocol is stated in the design record
  (size matrix, unattributed identification, recorded misreadings, no redraw
  without that evidence). No session has been recorded yet.
- **V03**: `docs/ui-spec.md` now pins one term per meaning, and the interface copy
  that contradicted it was corrected: "critical moment" headings became "key
  moments", Study highlight cards link with "Open in Review" instead of a bare
  ply, training evidence is named by its move instead of by a ply
  (`formatPlyNotation` was removed: a game can start from a non-1 fullmove, so
  `ceil(ply / 2)` would have printed the wrong number), and Moves no longer says
  "that ply".

## Batch E — release acceptance

R01 and R02 added the evidence matrix to
[`../web-release-roadmap.md`](../web-release-roadmap.md), separating what CI
covers from what needs a real device, a real zoom level, a real screen reader, or
a recording of an engine that misbehaves. A point-by-point upgrade to the
refinement findings is still
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md).

## Verification actually run

| Check | Result |
| --- | --- |
| `pnpm --filter @chess-review/{chess-core,shared,analysis,openings,tablebase,stockfish} test` | 21 / 16 / 98 / 8 / 6 / 15 tests passed |
| `pnpm --filter @chess-review/web test` | 376 tests passed in 49 files |
| `pnpm typecheck` | all packages and apps clean |
| `pnpm lint` | clean, now with `react-hooks` rules enabled |
| `pnpm exec playwright test` (default project) | 129 tests passed (3.7 min) on the frozen final revision, including the new Training entry-point, loading-state, empty-population and unreadable-queue-and-retry tests. One earlier full run of the same code reported 128 passed with a single `mistake-practice` failure; that spec passed 17/17 immediately afterwards with no code change. Its failure output was overwritten before it could be read, so **the cause is unrecorded**; the shared platform rate limit the Playwright config documents is a plausible candidate, not evidence |
| `pnpm build` | clean |
| `pnpm exec playwright test --config playwright.browser-core.config.ts --project=chromium` | 2 tests passed against the standalone production server (real Stockfish WASM, no local AI) |
| Visual baselines | refreshed after inspecting the diff: the shift is the added move row and the section rhythm, not clipped or moved content |
| Engine anomaly, real devices, browser zoom beyond fixed viewports, VoiceOver/NVDA, 5–8 first-time testers | **not run**; each is listed with its required evidence in the roadmap matrix |

The working tree was also checked for accidental additions: the only untracked
paths are this pass's own sources, tests and documents plus the harness's
`.omp/` session directory, which is now ignored. No reference repository, binary
asset or generated bundle was added.

## Deliberately not claimed

- This pass does **not** make the product equivalent to Chess.com or Lichess as a
  platform: peer play, pairing, events, social features and anti-cheat are out of
  scope and were not touched.
- Accuracy, WinPercent, game phases, classification, Brilliant, Great and human
  difficulty semantics were not changed. The only chess-analysis-adjacent
  addition is `resolveMoveInput` (move input parsing), covered by tests and
  affecting no evaluation.
