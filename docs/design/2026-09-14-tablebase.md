# Tablebase

Date: 2026-09-14

Phase 5 of
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md):
Syzygy tablebase results in Engine Lab, added as a correctness feature rather than
as a feature-parity checkbox.

## What changed

- `packages/tablebase` owns the seven-piece contract: the outcome categories, the
  piece-count rule, the position identity (EPD) and the payload normalization.
  `fenPieceCount()` was added to `@chess-review/chess-core`, beside `fenToEpd()`,
  so FEN parsing stays in the chess package.
- `GET /api/tablebase` is the only code that talks to `tablebase.lichess.ovh`. It
  forwards only the position identity, rejects a position above the coverage limit
  with an explanation instead of a result, and reports an unusable payload as
  `502`.
- Engine Lab gained a **Tablebase** tab, hidden during practice like the other two.
- `lib/tablebase.ts` caches answers in the `remote-positions` IndexedDB store
  through the new `lib/remote-position-cache.ts`, which the Opening Explorer now
  shares.
- Help, `ui-spec.md` and `data-model.md` describe the behaviour, the coverage rule
  and the store.

## Decisions worth recording

**One cache, one stale rule.** The Opening Explorer and the tablebase ask different
services for different shapes but with identical caching semantics: key by source
and position identity, treat an answer as fresh for a lifetime, serve an expired
one only when the refresh fails, and label it with its age when that happens. That
rule now exists once, in `remote-position-cache.ts`, instead of twice.

**Outcome categories are not collapsed.** `cursed-win` and `blessed-loss` exist
precisely because the fifty-move rule can still save a position the tables call
won or lost. Mapping them into `win`/`loss` would have made the panel state
something the tables do not. The W/D/L summary is therefore derived from the exact
category and shown beside it, not instead of it.

**Coverage is checked before the request, on both sides.** The panel needs the
piece count to explain *why* there is no answer, and the route must not be able to
return a result for an uncovered position even if it is called directly. The count
comes from the normalized position, never from a caller's guess.

**The engine never impersonates the tables.** `+8.2` is still an evaluation and is
never rendered as a theoretical result; the over-limit panel says in as many words
that Stockfish is the only evidence available there.

## Verification

- `packages/tablebase/src/tablebase.test.ts` covers the piece count and coverage
  rule, the EPD identity (counters cannot change the key), normalization including
  DTZ/DTM, `cursed-win` being preserved, a rejected partial payload, an invalid FEN,
  and a terminal position with no continuations.
- `e2e/tablebase.spec.ts` drives the real panel with a mocked endpoint: the proven
  result, DTZ/DTM, the table identity, the fetch age, the privacy note, every legal
  move grouped by outcome including a non-winning one, exploring a move into a
  variation, only `fen` being forwarded, an over-limit position producing **no
  request at all**, a rate-limit failure instead of a result, and the tab being
  absent during practice.
