# Move classification

Implementation: `packages/analysis/src/classification.ts`. This is an initial transparent product heuristic, not a claim about Chess.com internals.

## Precedence

1. checkmate (`best`)
2. `missed_mate`
3. `missed_win`
4. `book`
5. `forced` (only legal move)
6. `brilliant`
7. `great`
8. `best`
9. ordinary loss ladder / `interesting`
10. tactical `miss`
11. `blunder`

Every result includes engine rank, cp loss when meaningful, mover WinPercent before/after/loss, MultiPV gaps, legal move count, book/forced/checkmate flags, whether the played move was outside MultiPV, sacrifice evidence and exclusions. An outside-MultiPV move has no invented rank; its score comes from a restricted root search.

Temporary user moves on the analysis board call the same classifier through
`classifyExploratoryMove()`. They use parent-position MultiPV plus a restricted
root search when necessary, and retain the same Accuracy and evidence contract.
The result lives only on the runtime variation node: it does not alter the
canonical PGN, cache identity, player summaries or critical moments. Because a
runtime branch has no canonical theory boundary, its `isBook` input is false.

## Initial constants

- Great gap: at least 150 cp or 10 WinPercent points between top one and top two.
- Excellent/good/inaccuracy/mistake CP loss ceilings: 15/60/120/250.
- `interesting`: non-top-two move with at most 30 cp loss.
- Missed win: mover WinPercent at least 92 and drop at least 30.
- Tactical miss: drop at least 25 with a deterministic tactical best line.
- Book is accepted only when loss is at most 3 WinPercent points.

Mate transitions fall through a WinPercent ladder only after explicit missed-mate handling; mate is never stored as fake cp evidence.

## Brilliant

A Brilliant candidate requires engine rank one, at most one WinPercent point loss, verified genuine sacrifice evidence, a non-decided position (between 3 and 97 mover WinPercent), more than one legal move, and no obvious recapture/trivial check-escape exclusion.

The full-game assembler now produces `SacrificeEvidence` from SEE, the played root PV and Stockfish evaluation preservation. SEE alone is insufficient: a candidate must remain objectively sound through the opponent's best response, show enough compensation for the material investment, and avoid immediate tactical recovery. Unsupported material offers retain `genuine: false` evidence so the UI can explain the exclusion.

This intentionally changes production behavior from “Brilliant disabled” to “Brilliant available only with verified evidence.” Classification thresholds and precedence are unchanged; persisted objective results use algorithm version `objective-v1-preview.3` so older caches cannot masquerade as verified results.

## Critical (`great` schema value)

The persisted `great` classification is presented to users as **Critical**. It means a critical engine-best choice identified with MultiPV. Only-legal moves, obvious recaptures and trivial check escapes are excluded. When excluded, an engine top move remains Best. This is a presentation-name change only; the schema key, thresholds, precedence, cache identity and classification algorithm remain unchanged.
