# Mistake practice

Revised 2026-09-11 (S7) to an **in-place** exercise modelled on Lichess "Learn
from your mistakes". The earlier modal dialog was removed; there is one practice
flow, not two.

## What it is

Open a completed game review and choose **Find a better move**. The session takes
over the review board: it jumps to the position *before* one of your mistakes,
locks forward navigation, hides the engine evidence for that ply, and asks you to
play a better move on the real board. It does not modify the original PGN,
objective results, Notebook or Training V3 review ledger, and it stores nothing
between sessions.

## Flow

1. The launcher is one Review strip: player · N positions, then **Review White's
   N positions**. Account colour is the default when the game is linked.
   White/Black is asked when the game has no account identity, **or** when the
   current side has nothing to practise (so “try the other side” is not a dead
   end). Inaccuracies stay under Filters. Empty copy comes from the selector
   (`opening-theory` vs `missing-engine-evidence` vs no faults).
2. Starting practice switches the sidebar to the exercise. Engine arrows, eval
   numbers, the previous-move verdict, game summary and coach answers hide. A
   red arrow marks the original mistake only while the board is still on the
   prompt (`solving` / `rewinding`). It is hidden while an attempt is judged,
   because that piece has already left the prompt squares. The board still uses
   the review pieces and colours.
3. Play a move. The piece stays while it is judged (15s timeout). An accepted
   answer leaves that variation so you can keep playing the line. A rejected
   answer stays visible briefly, then the existing board animation rewinds to
   the prompt. Replaying the original mistake is never a solution. Timeouts and
   engine failures are **not judged wrong**.
4. **Hint** reveals only the square the stronger move starts from — never the
   destination — and marks it on the board with the brass hint ring. A hinted
   position is recorded as *hinted* and can never later be counted as solved, even
   if the visitor finds the move afterwards or views the solution. **View the
   solution** plays the stronger move as a variation and counts as *viewed*, not
   solved. **Skip** counts as skipped. **Next** keeps the current index until you
   click it. Browsing away while an answer is owed shows **You browsed away**. The
   session tally on the complete page separates solved / hinted / viewed / skipped.

The exercise is also reachable one moment at a time from Guided Review: the
Review panel's key-moment navigation offers **Try again** for the moment the board
is on, which starts the same session with a one-position queue
(`useRetrospect.startAt`). The eligibility rule is asked from the same module, so
a guided moment can never offer a position the full practice queue would exclude.

Navigation is locked at the chokepoint, not per button: `navigateToPly`,
`navigateNext`, `navigateLast`, autoplay and the right-arrow key all refuse to
move at or past the fault while an answer is owed, so neither the move list, the
evaluation graph nor the transport can disclose the answer. Display policy lives
in `practicePresentation()` so each panel does not guess `active`/`locked`.

## Answer exposure is recorded, not assumed

Free analysis and the exercise disagree about what a visitor has seen. In free
analysis the board shows the engine arrows, the evaluation and the verdict panel
for the ply on screen; entering the exercise afterwards cannot unsee that. Rather
than pretend every attempt is a cold read, the workspace records exposure:

- `useRetrospect.noteAnswerExposed(ply)` is called whenever the board rests on a
  ply with the analysis visible and no session running. That set is per workspace,
  not per attempt.
- Starting an attempt on such a ply sets `RetroRuntime.answerExposed`, shows the
  **Review practice** chip and states plainly that the solve is practice rather
  than a first-time find.
- The practice tally carries `afterExposure`, and the end-of-review state says how
  many attempts followed a position whose analysis had already been shown. A
  solved-after-exposure position still counts as solved; the sentence denies the
  "first-time solve" reading instead of rewriting the result.

`practicePresentation().hideAnalysisExports` extends the same rule to the export
menu: **Canonical JSON**, **Annotated PGN**, **Position PNG** and **Review PNG**
are disabled with an explanatory line while an answer is owed, because each one
contains the answer. Original PGN and the share link stay available: the share
payload is the game's PGN, not its analysis.


## Canonical policy

`packages/analysis/src/mistake-practice.ts` owns selection and acceptance; the
session state lives in `apps/web/src/hooks/use-retrospect.ts`.

**Selection.** V2 `quality` mistake or blunder, optionally inaccuracy, plus
missed-win/missed-mate annotations. A move still inside recognised opening theory
is skipped, because the opening has many playable moves and punishing a normal
developing move teaches nothing. Requires matching root FEN and a legal Stockfish
best move different from the one played. It never reclassifies the game.

**Acceptance.** An exact engine-best answer, or any move within **4 mover
WinPercent points** of the best root score. A known winning mate must stay a
winning mate; newly allowing mate fails even when WinPercent saturates. Mate
distance need not match.

**Unknown is not wrong.** A move outside the saved MultiPV triggers a fresh
restricted `searchmoves` search at depth 12, which is issued with the game's
`startFen` and the UCI history before the position, so repetition and fifty-move
judgements are evaluated in the same context as the game itself. If the
engine cannot answer — cancellation, worker failure, missing evidence — the move
is **not** marked wrong and the position stays open. The analysis scheduler bounds
resource contention. No AI service or LLM is involved.

## Relationship to Lichess

Reference: `lila` `ui/analyse/src/retrospect/` (the UI label is "Learn from your
mistakes"), entry gated on a full computer analysis. Parity is deliberate:

| Aspect | Lichess | Here |
| --- | --- | --- |
| Exercise form | In-place on the analysis board, forward navigation locked | Same |
| Prompt | Position before the fault, "X was played" | Same |
| After a good move | Piece stays; keep exploring or Next | Same |
| View solution | Jumps to the computer's move, then Next | Plays the stronger move as a variation, then Next mistake |
| Off track | "You browsed away" / Resume learning | Same |
| Hiding | Engine lines hidden on unsolved candidates, including the move list | Same, plus engine panels and arrows |
| Acceptance | Winning-chance loss within 4 points, mate preserved | Same threshold |
| Also accepted | Masters-database move, checkmate, the game's own solution | Checkmate and the solution |
| Candidate selection | Evaluation swing above 10 points | V2 mistake/blunder bands (also 10 points) |
| Opening exception | Masters database frequency | Canonical theory boundary (`isBook`) |
| Progress | Solved / total, reset, flip colour | Solved / total, practice again |
| Hint | None | The square the stronger move starts from, recorded as hinted |

Two differences are known and accepted. The opening exception uses recognised
theory rather than game frequencies, because this project has no masters database
— it is a position-based approximation. And the feedback wording is this
project's own; Lichess localises its own strings.

**This project's addition.** Once a position is solved the session can explain
*why the original move felt natural*: Maia's probability for the move actually
played at the visitor's target Elo, with the existing find-difficulty label for
the stronger move. Lichess's retrospect shows no human-model evidence.

The explanation reads the played move's probability and policy rank from the
persisted `HumanAnalysis`, not from Maia's candidate list. Maia's move review
returns only its top `multiPv` policy moves, so the move someone actually played —
exactly the one this feature explains — is usually absent from that list, because
a blunder is a move humans rarely choose. Looking it up there would disable the
explanation in the case it exists for. When Maia did not evaluate the engine's
move, both the percentage and the difficulty label are omitted rather than
computed from a placeholder zero, and a sub-1% probability prints as `<1%`
instead of a misleading `0%`. Because Maia only exists in Enhanced Local mode, the
exercise is complete without it; the panel then says so and points at Review's
human analysis. Nothing is generated by a language model, so the explanation can
never contradict the engine.

## Deliberate limits

Finite-depth engine judgement, not proof of a unique solution. No durable attempt
history, Elo, mastery or spaced repetition is claimed. Existing Training's **Mark
position reviewed** remains a separate action. Original Accuracy, quality and
annotations, Great/Brilliant, game phase and the analysis algorithm version are
unchanged by practising.

Next: durable attempt records with backup/delete compatibility, then a training
queue that schedules real attempts separately from source-position reviews.
