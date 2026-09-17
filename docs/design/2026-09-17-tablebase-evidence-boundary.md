Status: Proposal
Baseline: 2026-09-17

# Tablebase evidence boundary

Date: 2026-09-17

`TablebaseEvidenceV1` as an optional, versioned evidence boundary for the
existing seven-piece Syzygy lookup. The lookup exists today; this document states
how its result would enter the canonical analysis data without becoming
classification, Accuracy or Training proof.

## Why

The product already has a working tablebase surface. `packages/tablebase` owns
the seven-piece Syzygy contract, `GET /api/tablebase` proxies the public tables
through `tablebase.lichess.ovh`, and the Engine Lab panel
(`components/review/tablebase-panel.tsx`) displays proven WDL/DTZ/DTM for
positions with at most seven pieces. The cache lives in the shared
`remote-position-cache.ts` store under the `"tablebase"` source key.

But the tablebase result is a manual lookup. It is not part of the canonical
`GameAnalysisV2` record, so it cannot be referenced by the analysis, the review
or the Training report. `docs/analysis-spec.md` § "Tablebase boundary" already
states the requirement:

> A later correctness enhancement may add a versioned tablebase fact
> (`TablebaseEvidenceV1`) containing WDL/DTZ, exact position identity, tablebase
> source/version and availability/fallback state. It must remain distinct from
> cp and mate scores and would require fixtures before affecting classification
> or player-intelligence claims.

This document specifies that boundary.

## Evidence contract

`TablebaseEvidenceV1` is a per-move optional enrichment, stored alongside
`MoveAnalysisV2` fields when the position falls within coverage. It is not a
score, not a classification input and not an Accuracy input.

| Field | Type | Description |
| --- | --- | --- |
| `version` | `1` | Evidence schema version |
| `positionEpd` | `string` | EPD identity of the position, from `tablebasePositionKey()` |
| `source` | `"lichess"` | The upstream service, matching `TablebasePositionV1.source` |
| `tables` | `"syzygy-7"` | The table set, matching `TablebasePositionV1.tables` |
| `pieceCount` | `number` | Piece count of the position |
| `category` | `TablebaseCategory` | The proven outcome category |
| `dtz` | `number \| undefined` | Distance to zeroing, when reported |
| `dtm` | `number \| undefined` | Distance to mate, when reported |
| `fetchedAt` | `string` | ISO timestamp of the lookup |
| `stale` | `boolean` | Whether the result was served from an expired cache |

### Relationship to existing types

`TablebasePositionV1` in `packages/tablebase/src/tablebase.ts` is the full
response including legal moves grouped by outcome. `TablebaseEvidenceV1` is a
strict subset: the position's own category and distances, without the move list.
`TablebaseCategory` preserves the exact category including `"cursed-win"` and
`"blessed-loss"`. `TABLEBASE_MAX_PIECES` (7) and `tablebaseCovers(fen)` are the
existing coverage gate; a position above seven pieces never receives evidence.

## What the evidence is not

- **Not classification.** Move quality is led by mover WinPercent loss from
  Stockfish search. A tablebase category is a theoretical outcome, not a
  search-derived score. A `+8.2` evaluation remains `+8.2` for classification
  even if the tablebase says the position is a draw.
- **Not Accuracy.** Accuracy is derived from the WinPercent sequence. A
  tablebase result does not change the WinPercent input.
- **Not Training proof.** Training mastery is built from reviewed-position
  outcomes. Tablebase evidence is not an attempt outcome.
- **Not a substitute for Stockfish.** A Stockfish score must not be described as
  tablebase-proven, and a tablebase category must not be described as an engine
  evaluation. The two are distinct evidence kinds.

## Absence rule

**Absence of tablebase data must never change a label.** A position that falls
outside coverage, or whose lookup fails, or whose lookup was never attempted,
retains its Stockfish-derived classification, quality, annotations and Accuracy
unchanged. No field in `MoveAnalysisV2` may be downgraded, upgraded, flagged or
annotated because a tablebase result is missing.

This is not a degraded state. The vast majority of positions have more than
seven pieces and will never receive tablebase evidence. The evidence is additive
and optional; its absence is the normal case.

## How a versioned payload would enter the canonical analysis data

The existing `GameAnalysisV2` record has optional enrichment slots: `human` for
Maia move-review evidence and `coach` for AI-coach prose. `TablebaseEvidenceV1`
would follow the same pattern:

1. **Slot.** `MoveAnalysisV2.tablebase?: TablebaseEvidenceV1` — optional, absent
   by default.
2. **Population.** During or after full-game analysis, for every ply whose
   `fenAfter` position has at most `TABLEBASE_MAX_PIECES` pieces,
   `tablebaseCovers` returns `true` and a cached or fresh lookup succeeds, the
   enrichment is written.
3. **Identity.** The enrichment is keyed by `positionEpd + source + tables`, so
   a different table set (e.g. a future eight-piece Lomonosov set) would be a
   different evidence version with a different `tables` value.
4. **Versioning.** The `version: 1` field allows future schema changes without
   invalidating existing records. A reader that does not understand a version
   ignores the field, the same way a build that does not understand `human-v2`
   ignores it.
5. **Fixtures.** Before any consumer reads `TablebaseEvidenceV1` for a
   classification or player-intelligence claim, a fixture set must pin the
   expected behaviour. This is the requirement from `docs/analysis-spec.md`:
   fixtures before claims.

## Coverage rule for the UI

- When `tablebase` is present on a move, the review can state the proven
  outcome alongside the Stockfish evaluation: "Tablebase: draw (DTZ 42)"
  beside "+3.2". The two are labelled separately and never merged.
- When `tablebase` is absent, nothing is shown. No "tablebase unavailable"
  message on a position with 14 pieces — absence is normal.
- The existing Engine Lab tablebase panel is unchanged. It remains a manual
  lookup surface and is not coupled to `TablebaseEvidenceV1`. The panel reads
  from the `remote-position-cache`; the evidence reads from the analysis record.

## Non-goals

- No tablebase-aware classification bands.
- No tablebase probing during engine search (browser Stockfish WASM does not
  read Syzygy files; evidence comes from the public HTTP tables).
- No DTZ/DTM-optimal move validation for the played move.
- No offline tablebase. The lookup requires `tablebase.lichess.ovh` through
  `GET /api/tablebase`. Offline play has no evidence and no error — just absence.

## Unresolved questions

1. Should the enrichment be populated eagerly during full-game analysis (for
   every qualifying position), or lazily when the visitor navigates to one?
2. Should `TablebaseEvidenceV1` be considered permanent once written (Syzygy
   results do not change), or carry its own staleness like the 24-hour
   `remote-position-cache` TTL?
3. Should the annotated PGN export include a `[%tb category dtz dtm]` command
   for positions with tablebase evidence?
