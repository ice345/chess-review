# Mistake practice (S2a)

Implemented 2026-09-10. Open a completed game review and select **Practice my
mistakes**. This is a single-game, session-only exercise. It does not modify the
original PGN, objective results, Notebook or Training V3 review ledger.

## User flow

Choose White or Black (imported account color is the default), optionally include
inaccuracies, and solve each position from **before** the original error. A modal
board hides evaluation, arrows, original move and engine continuations. Users may
click or drag pieces, choose all four promotions, or enter UCI using a keyboard.
Illegal moves and the original played move can be retried. A hint identifies the
starting square of the saved best move; Show answer reveals the saved legal PV.
Successful answers reveal their own continuation. Users can step through it,
open the full original evidence, skip, or continue to the next position.

The session summary separates solved without hints, solved with hints, answer
viewed and skipped. Closing/reloading or changing filters starts a new session.
No durable success history, Elo, mastery or spaced repetition is claimed.
Existing Training's **Mark position reviewed** remains a distinct action.

## Canonical policy

`packages/analysis/src/mistake-practice.ts` owns selection and answer acceptance.
Selection uses existing V2 `quality` mistake/blunder, optionally inaccuracy, and
missed-win/missed-mate annotations. It requires matching root FEN and a legal
Stockfish best move different from the original move. It does not reclassify games.

An exact engine-best answer is accepted. Other candidates are accepted at no more
than **2 mover WinPercent points** below the best root score, using existing
White-POV score conversion and WinPercent functions. This is a practice tolerance
matching the Excellent quality band's numeric tolerance, not a new game-quality
classification. A known winning mate must remain a winning mate; newly allowing
mate fails even when WinPercent saturates. Mate distance need not be identical.

Saved MultiPV is reused. An unlisted move is **unknown, not automatically wrong**:
the browser runs a fresh unrestricted root search followed, if necessary, by a
restricted `searchmoves` search at the same depth (12–15), with the original game
history. The existing analysis scheduler bounds resource contention. Cancellation,
30-second timeout, worker failure or missing evidence does not mark an answer
wrong. Searches stop on close; no AI service or LLM is needed.

These are finite-depth engine judgments, not proof of a unique solution. Original
Accuracy, quality/annotations, Great/Brilliant, game phase, and analysis algorithm
version are unchanged. No database or backup format migration is introduced.

## Reference and deliberate scope

Interaction reference: Lichess's official [Learn from your mistakes description](https://lichess.org/@/lichess/blog/learn-from-your-mistakes/WFvLpiQA).
We reuse the self-attempt / optional answer / continuation flow. We do not copy
its historical winning-chances constants or its masters-opening exception, and
do not claim exact compatibility with Lichess's answer acceptance.

Next: durable attempt records with backup/delete compatibility, then a training
queue that schedules real attempts separately from source-position reviews.
