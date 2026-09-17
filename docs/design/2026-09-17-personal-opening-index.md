Status: Proposal
Baseline: 2026-09-17

# Personal opening index

Date: 2026-09-17

A local, player-specific opening index built from the visitor's own library.
The product does not yet build this index; this document states what it would
contain, how it differs from the existing opening profile and from external
databases, and when a line is reportable.

## Why

The Training report's opening profile (`OpeningProfileV2` in
`packages/analysis/src/study-v2.ts`) groups games by canonical ECO/name/colour
and reports win rate, error rate and problem positions. But it cannot answer
where the visitor's games first *leave theory*, because the opening recognition
in `packages/openings/src/recognition.ts` walks backward from the deepest known
position and records `matchedPly` / `theoryUntilPly` — it identifies the opening,
not where the player's own repertoire diverges from it.

A personal opening index would track the positions the visitor actually reaches,
the moves they actually play, and where those moves first differ from the
reference index. It answers the question: "In the Italian, where do I usually
leave book, and how do those deviations perform?"

## Evidence contract

The index is local, per-player, and built from the visitor's own analysed
library — the same `StudyGameInputV2` population the Training report consumes.

### Position identity

Lines are identified by position (EPD via `fenToEpd` from
`@chess-review/chess-core`), never by PGN move-text prefix. Two games that
reach the same position by transposition belong to the same line. This is
consistent with the existing opening recognition, which indexes positions
against an EPD-keyed map (`createOpeningIndex` in
`packages/openings/src/recognition.ts`), and with the Opening Explorer, which
keys its cache by `explorerPositionKey` (also EPD).

### Per-line record

| Field | Type | Description |
| --- | --- | --- |
| `positionEpd` | `string` | EPD identity of the position |
| `eco` | `string` | ECO code from the recognised opening, if any |
| `openingName` | `string` | Opening name from the recognised opening |
| `variation` | `string \| undefined` | Variation name when the index carries one |
| `color` | `PlayerColor` | The player's colour in these games |
| `gamesReached` | `number` | Games where the player reached this position |
| `results` | `{ white: number; draw: number; black: number }` | Result split |
| `playerMoves` | `PlayerMoveEntry[]` | Distinct moves the player made here |
| `earliestDeviationPly` | `number \| undefined` | The first ply in any game where the player's move was not in the reference index |
| `referenceDepth` | `number` | Deepest ply the reference index recognises on this line |

### Per-move entry

| Field | Type | Description |
| --- | --- | --- |
| `uci` | `string` | The move played |
| `san` | `string` | SAN notation |
| `count` | `number` | Times this move was played |
| `results` | `{ white: number; draw: number; black: number }` | Result split for games where this move was played |
| `inReference` | `boolean` | Whether the resulting position exists in the reference index |

### Reference index

The reference is the build-time `LICHESS_OPENING_INDEX` generated from
`lichess-org/chess-openings` and stored as `packages/openings/src/generated/openings.json`.
It is EPD-keyed. The personal index records whether a player's move leads to a
position that exists in this reference; if not, `earliestDeviationPly` is set.

## Coverage rule

- **Minimum games before reporting.** A position is reported only when the
  player has reached it in at least **three** games. Below that threshold the
  line exists in the raw data but is not surfaced in any aggregate, chart or
  recommendation. The UI states "Not enough games to report this line" rather
  than showing a two-game sample as a trend.
- **Colour split is always present.** Each line is inherently colour-specific
  because the same position as White and as Black are different decisions. This
  matches the existing `studyOpeningKeyV2`, which includes `playerColor` in the
  key.
- **Result split requires a known result.** Games whose `result` cannot be
  parsed as W/D/L (e.g. `*`, ongoing, or adjudicated without a clear outcome)
  are counted in `gamesReached` but excluded from the result split, with the
  count difference visible.

## What this is not

### Not an ECO dataset

The ECO code comes from the existing opening recognition and is metadata on the
line, not the line's identity. Two positions in the same ECO code are separate
lines if their EPDs differ. The index does not group by ECO or report ECO-level
statistics — that is the existing opening profile's job.

### Not a Lichess explorer

The Opening Explorer (`packages/openings/src/explorer.ts` and the
`GET /api/explorer` route) reports population-level frequencies from the Lichess
database. The personal opening index reports only the visitor's own games. It
does not query any remote service and does not cache third-party data. The two
surfaces answer different questions: "What do people play here?" versus "What do
I play here?"

### Not a repertoire trainer

The index records what the visitor played; it does not prescribe what they
should play. It has no "learn this line" action, no drill mode and no
spaced-repetition schedule. Those would be consumers of the index, not part of
it.

## Non-goals

- No transposition graph. The index records which positions were reached, not
  the move orders that led to them. Transposition detection is a presentation
  concern, not an evidence concern.
- No novelty detection against master games. The reference index is the
  build-time lichess-org/chess-openings dataset, not a live database. A move
  that is absent from the reference is "not in the reference index", not "a
  novelty".
- No Elo-conditioned statistics. Maia probability is a per-move enrichment in
  Review, not a repertoire-level signal. The personal index reports raw counts.
- No import from external repertoire files (`.pgn` study collections, ChessBase
  `.ctg`). The population is the visitor's own library as it exists in
  IndexedDB.

## Unresolved questions

1. Should the minimum-game threshold be configurable, or fixed at three? The
   Training report uses a `minimumSampleSize` filter; should the personal index
   share that control?
2. The reference index is generated at build time. Should a stale reference
   (e.g. a new variation added to `chess-openings` after the build) be detected
   and reported, or is the build-time snapshot the contract?
3. Should the personal index be persisted as a separate IndexedDB store, or
   computed on demand from the existing `objective-analysis-index` projections?
   The Training report itself is rebuilt on demand; a separate store adds
   durability but also a cache-invalidation surface.
4. How deep into the game should the index track? The existing `theoryUntilPly`
   marks where theory ends; positions beyond that are middlegame decisions, not
   opening repertoire. Should the index stop at `theoryUntilPly + N` plies, or
   track every position the player reached?
