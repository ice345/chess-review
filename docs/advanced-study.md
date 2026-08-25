# Advanced study

Implementation: `packages/analysis/src/study.ts`. Browser composition:
`apps/web/src/lib/advanced-study-library.ts` and `/training`.

## Boundary

Advanced study consumes completed, current-algorithm `GameAnalysisV1` records.
It never runs Stockfish, Maia or a language model, and it never writes into a
canonical game analysis. Stockfish remains the source of each objective
classification and its evidence. Maia data is not used to relabel a move. Coach
text is not an input to trend, repertoire or weakness calculations.

Manual PGNs contribute a view for each meaningful named player. Connected games
contribute only the linked account's known color. Cache values are matched by
normalized PGN; if more than one current-algorithm cache exists for a game, the
latest `createdAt` record is selected. Engine configurations are disclosed in the
report because a library may contain reviews run at different depths or MultiPV
settings.

## Multi-game trends

Games are ordered by connected-game timestamp, valid PGN date, or original
library-created timestamp in that order. Opening a review never changes trend
chronology. Overall form is the arithmetic
mean of already-computed canonical per-game Accuracy values; this is a summary of
game Accuracy, not a replacement Accuracy formula. Phase form similarly averages
the available canonical per-game phase Accuracy values. Recent change compares
up to five most recent values with an equally sized preceding block. Missing
canonical Accuracy remains missing rather than being converted to zero.

## Opening repertoire

Groups use player color plus ECO, name and variation. White and Black are never
merged. Each entry reports games, known-result score rate, average canonical
overall/opening Accuracy, and the share of the player's structural-opening moves
whose existing classification is Inaccuracy, Mistake, Blunder, Miss, Missed win
or Missed mate. Opening recognition and structural game phase remain separate
canonical inputs.

## Recurring weaknesses

The weak-move set is the existing six objective warning/error classifications:
Inaccuracy, Mistake, Blunder, Miss, Missed win and Missed mate. Each qualifying
move is assigned exactly one deterministic study category:

1. Miss, Missed win and Missed mate become `missed-opportunities`.
2. Remaining errors use their canonical opening, middlegame or endgame phase.

A category appears only with at least two incidents in at least two distinct
games. Evidence retains game ID, ply, SAN, phase, classification and canonical
WinPercent loss. Ordering priority uses a documented study-only severity order
(Inaccuracy 1, Mistake/Miss 2, Blunder/Missed win 4, Missed mate 5), average
WinPercent loss and a bounded recurrence bonus. The score ranks training tasks;
it is not Move Quality, Accuracy, Elo or an engine evaluation.

## Training queue

`TrainingQueueItemV1` is stored separately in the `training-queue` IndexedDB
store. Its deterministic identity is player key plus weakness category. Adding a
weakness saves up to five highest-impact evidence references. Status transitions
are queued → in progress → completed, with reopening and explicit removal. Source
links open `/review/[gameId]/moves?ply=N`; the persistent Review shell applies the
requested canonical ply after the game has loaded.

The queue is browser-local. It is not synced across devices and it does not yet
schedule spaced-repetition dates. Those are product extensions, not hidden or
partially implemented Phase 7 behavior.
