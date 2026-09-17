Status: Historical
Baseline: 2026-09-15
Superseded by: [docs/ui-spec.md](../ui-spec.md)
Do not use as the current product contract.

# Review desk order, withheld answers and move evidence

Date: 2026-09-15

Follow-up to
[`../audits/2026-09-15-liz-bluebird-product-audit-and-remediation.md`](../audits/2026-09-15-liz-bluebird-product-audit-and-remediation.md)
items U01, U03 and U04. The Review route already worked as a workspace; these
changes decide what it says first, and stop it from showing an answer it is about
to ask for.

## U01 — one primary task per screen

The Review panel used to open with the full move list and place the current
move's verdict *after* it, so on a normal-length game the visitor scrolled past
twenty moves to reach the explanation of the one they were on.

The panel now reads in the order the lesson is taught:

| Order | Block | Why |
| --- | --- | --- |
| 1 | next-step strip (ply 0 only) | names the first key moment and where the full list lives |
| 2 | key-moment navigation | progress, the guided action, and *Finish review early* on the same row |
| 3 | current move verdict | one sentence about the move on the board, evidence behind *Why?* |
| 4 | practice launcher | batch error practice stays available, no longer competes for first attention |
| 5 | nearby moves | `ReviewMoves` with `contextWindow={5}`: the current ply ± five, plus a link to the full list |
| 6 | engine candidate lines | unchanged, still expanded, because the Moves evidence links into them |
| 7 | game summary | overview and the collapsed evaluation timeline, addressable as `#game-summary` |

`ReviewMoves` gained an optional `contextWindow`; only Review passes it. Moves
still renders the whole game, which is why the emphasis-count test moved to the
Moves route: emphasis is a move-list feature and the full list lives there.
*Finish review early* moved inside the key-moment row — it reports on that
progress, so it belongs with it, and it stops occupying a row of its own.
*Next key moment* is the primary button while the board is between moments.

## U03 — a withheld answer is a real state

Guided review previously walked the visitor onto the fault position and showed
its verdict, arrows and candidate lines; the "Try again" action afterwards could
not be a cold read, and nothing in the session recorded that.

`review-store.ts` now holds `concealedPly`. Guided navigation (`← Previous key
moment` / `Next key moment →`) conceals a moment that the practice queue would
accept, and the strip then offers **Try it** or **Show the analysis**. While
concealed:

- the board hides engine arrows, evaluation values and the quality badge;
- the verdict panel and the candidate lines are not rendered;
- the move list and the key-moment overview hide that ply's quality, the same way
  practice hides a fault;
- analysis exports are disabled with an explanatory line.

`practicePresentation()` in `lib/practice-presentation.ts` remains the single
policy module: `concealedAnswerPly()` decides whether a ply is withheld and
`withheldPresentation()` derives the visible-state flags from the practice
policy, so a panel can never invent its own hiding rule. `useWithheldPly()` is the
one hook the board, the move list and the overview read.

Any other navigation retires the concealment — looking is a decision, and it is
recorded: `noteAnswerExposed(ply)` marks every ply the visitor actually saw with
the analysis visible. An attempt on an exposed ply is labelled **Review practice**
and counted in `afterExposure`, so the end-of-review tally can say how many
attempts followed an answer that was already on screen. Objective quality,
Accuracy and annotations are untouched by any of this; only the session's own
record changes.

## U04 — evidence, in words a visitor can use

*Why?* used to print the internal rule identifier next to raw numbers
(`engine-top-choice · Win% loss 0.0 · …`). It now shows one sentence, mapped from
canonical evidence by `lib/move-evidence-copy.ts`:

- a missed mate or missed win states exactly that, from its annotation;
- Brilliant states the investment and that compensation survives the best answer;
- Critical states that the alternatives were worse, with the recorded gap;
- Book, Forced and Sacrifice state what they are;
- a near-zero loss states that the evaluation does not move;
- any other loss states the cost **and** that the analysis records the cost, not
  the missed idea — this build has one tactical motif detector (`sacrifice`) and
  does not name a cause it did not detect.

The disclosure below it holds the evidence the claim rests on: engine choice and
rank, winning chances before → after for the mover, which search produced them,
the sacrifice evidence when one was recorded, and the recorded exclusions.
Internal identifiers move into a nested *Classification internals* disclosure.

The Moves route shows the same sentence, adds **Show the engine's answer on the
board** (it replays the recorded first line from the move's own root) and keeps
the evidence behind a disclosure. The button is withheld while an answer is owed.

## U07 — the end of the review hands the game to Training

The completion state used to report how many queue *items* mentioned the game and
call that a position count. It now plans the handoff instead:

- `gameTrainingWeaknesses(analysis, gameId, color)` in `packages/analysis/src/study.ts`
  applies the recurring-weakness rule to one game, so the positions offered here are
  the same evidence the Study report would recognise. `buildWeaknesses` now calls
  the same rule instead of carrying its own copy.
- `planTrainingAddition(items, playerKey, weaknesses)` in
  `apps/web/src/lib/training-queue.ts` computes, before anything is written, which
  positions the write would store: only this game's positions, each counted once
  across the learner's tasks, capped by `MAX_TASK_EVIDENCE` per task. The offer
  lists them with their move notation and loss, and a position that does not fit a
  full task is reported as deferred rather than silently dropped.
- `applyTrainingAddition` stores the plan in one transaction and is idempotent: a
  second click finds nothing new. Adding unreviewed positions to a completed task
  reopens it; it never touches the reviewed-position progress.
- The learner is the record's own account when the game has one. A manual import
  has no learner, so the visitor names the side and the panel starts on the side
  that actually recorded trainable positions.
- The queue's own recorded evidence is not a mastery claim. "Reviewed" still means
  the position was looked at, and the completion copy keeps saying so.

From the completion, **Open the task →** links to
`/training?player=<playerKey>&task=<taskId>` so the handoff lands on the task it
just created instead of a generic report.

## Keyboard operation and screen-reader semantics

Moving a piece needed a pointer: the board's squares are `div`s with no names and
no focus, and the transport only walked the game. A visitor who cannot drag had no
way to state a move at all.

Two additions close that, and one boundary is stated rather than faked:

- **`resolveMoveInput(fen, input)`** in `packages/chess-core/src/game.ts` reads a
  move the way a person writes one: SAN (`Nf3`, `exd5`, `O-O`, `e8=Q+`) or UCI
  (`g1f3`, `e7e8q`). It validates through chess.js and returns canonical
  `from`/`to`/`promotion`/`uci`/`san`, or `null`. A promotion must name its piece:
  the board asks that with a chooser, so `e7e8` is refused instead of being
  silently read as a queen. UCI-shaped input is read only as UCI, so a mistyped
  `e7e8k` cannot fall through to a SAN parse.
- **`MoveEntry`** is the review shell's move field. It hands the resolved move to
  `runtime.playMove`, which is the board's own `playBoardMove` — so a practice
  attempt is judged and a variation is opened exactly as a drop would do it, with
  no second routing rule in the panel.
- **What the board says about itself.** `squareRenderer` wraps each square in a
  named group (`Square g1`) and reapplies the highlight styles the library's
  default square content would have drawn, so selection and move hints survive.
  Every piece renderer in `lib/board-pieces.tsx` emits its own name and square as
  visually hidden text (`White knight on g1`) beside the art, which is what names
  the library's focusable draggable element. The workspace also exposes the
  current position as a FEN for on-demand reading and announces every move
  politely (`1. e4. Black to move.`).

The square wrapper is a `group`, not an `img`: `img` is children-presentational,
so it would have pruned the draggable piece from the accessibility tree and left
focusable, nameless board elements behind.

Squares stay unfocusable on purpose. Making 64 non-interactive `div`s focusable
would advertise an operation that does not exist; operating the board is the move
entry, the transport, the keyboard shortcuts, and the named move-list and
candidate buttons, all of which already carry their move. A real VoiceOver and
NVDA pass with a first-time user remains outstanding and is not claimed here — the
automated coverage asserts the labels, the announcements and the keyboard path.

## What still needs a human

Three items from this audit cannot be closed by code or CI:

| Item | Evidence required | Current state |
| --- | --- | --- |
| Piece and colour legibility | a size matrix (32/40/48/56 px) read by 5–8 people who do not know the set, recording which piece and colour was misread, before any redraw | `apps/web/src/app/design/pieces` renders the comparison; no session has been recorded |
| Reading rhythm | the same screens read with decorative layers off and in grayscale; primary actions and grouping must still be legible; then eye-tracking or think-aloud to see whether the eye finds the primary action | sections, headings and the token scale are settled; no session has been recorded |
| Real zoom, real devices, an engine that misbehaves | browser zoom at 200%/400%, a real phone and tablet, and a review run with a stalling worker | CI covers layout at fixed viewports and the failure paths in code; no recorded session |

