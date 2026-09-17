Status: Proposal
Baseline: 2026-09-17

# Move time evidence

Date: 2026-09-17

Per-move clock evidence for human analysis. The product does not yet extract or
display think time; this document states what the evidence would contain, when it
can exist, and what it must never be used for.

## Why

A player's time allocation is meaningful context for their decisions. Spending
ten seconds on a critical position and ninety seconds on a forced recapture
tells a story the engine cannot see. But time data only exists when the source
PGN carries it, and inventing think time for a game without clocks would be a
fabricated claim.

## Evidence contract

`MoveTimeEvidenceV1` is a per-move enrichment, stored alongside the canonical
`MoveAnalysisV2` fields. It is not an objective evaluation input.

| Field | Type | Unit | Description |
| --- | --- | --- | --- |
| `version` | `1` | — | Evidence schema version |
| `clockBefore` | `number` | seconds | Remaining clock before the move, from `[%clk]` |
| `clockAfter` | `number` | seconds | Remaining clock after the move, from the next ply's `[%clk]` |
| `timeSpent` | `number` | seconds | `clockBefore − clockAfter + increment`, non-negative |
| `increment` | `number` | seconds | Per-move increment from the game's `TimeControl` header |
| `source` | `"pgn-clk"` | — | The PGN `[%clk]` command, the only source today |

### Existing code this would read

Clock commands already appear in imported PGN comments. `NormalizedPly.comment`
in `packages/chess-core/src/game.ts` preserves the raw comment text including
`[%clk]` and `[%emt]` commands. `displayPgnComment()` in
`apps/web/src/lib/imported-annotations.ts` strips them for the move list using
the regex `/\[%(?:clk|emt)\b[^\]]*]/gi`, which confirms the product already
recognises these commands as machine telemetry distinct from author text.

A future extractor would parse `[%clk H:MM:SS]` from `NormalizedPly.comment`
and derive `timeSpent` from adjacent plies' clocks and the `TimeControl` header.

### Per-game coverage

`MoveTimeCoverageV1` declares whether the game carries clock data at all, and
per player:

| Field | Type | Description |
| --- | --- | --- |
| `available` | `boolean` | At least one ply has a `[%clk]` comment |
| `playerCoverage` | `Record<PlayerColor, { pliesWithClock: number; totalPlies: number }>` | Per-player completeness |
| `timeControl` | `string \| undefined` | The `TimeControl` PGN header, verbatim |
| `increment` | `number` | Parsed increment in seconds, 0 when absent |

Coverage is `false` when no ply in the game carries a `[%clk]` command. A
partially clocked game (some plies missing `[%clk]`) reports the per-player
ratio and states it in the UI rather than interpolating.

## Coverage rule

- A game without `[%clk]` comments has `available: false` and no move time
  evidence is produced. The UI must never display fabricated think time, imputed
  duration, or a clock-based aggregate (e.g. "average think time") for such a game.
- A game with partial clocks states the ratio. Per-move time is shown only for
  plies where both `clockBefore` and `clockAfter` are known; gaps are gaps, not
  estimates.
- When time evidence is absent, the relevant UI surface renders nothing rather
  than a zero or a placeholder — the same pattern `displayPgnComment` uses today
  (returning `undefined` for clock-only comments).

## Invariants

1. **Time is never an objective evaluation input.** Stockfish remains the
   objective truth. `timeSpent` does not enter WinPercent, Accuracy,
   classification, quality, annotations or any field described by
   `docs/analysis-spec.md`. It is informational evidence for the human reviewer.
2. **No fabrication.** A game without `[%clk]` never receives synthesised clock
   data. The distinction is declared by `available`, not inferred from the
   absence of fields.
3. **No retroactive application.** Existing `GameAnalysisV2` records are not
   invalidated by the addition of time evidence. Time evidence is an additive
   enrichment, like `human-v2`: it lives beside the canonical analysis, never
   replaces it.
4. **Clock data is source data.** `clockBefore` and `clockAfter` are the PGN's
   own `[%clk]` values. The product does not correct, adjust or normalise them
   beyond the arithmetic of `timeSpent`.

## Non-goals

- Per-move time is not a factor in Human Find Difficulty. That heuristic
  (`docs/human-analysis.md`) uses Maia probability, legal-move count, tactical
  evidence and forcing nature. Adding a latency signal would conflate the
  difficulty of the position with the player's clock state.
- No time-pressure detection heuristic. The evidence records what the clock
  said; labelling a phase "time trouble" would be an editorial claim this
  version does not make.
- No aggregated "time management profile" in the Training report. That is a
  possible consumer of move time evidence, not part of the evidence itself.
- No `[%emt]` (elapsed move time) support. Lichess and Chess.com both emit
  `[%clk]`; `[%emt]` is rarer and its semantics differ. A later version may add
  a second source kind.

## Unresolved questions

1. Should `timeSpent` be clamped to zero when `clockAfter > clockBefore +
   increment` (a server-side rounding artefact), or should the raw negative
   value be preserved with a flag?
2. The `TimeControl` header format is not standardised across providers.
   Chess.com uses `"600"` or `"180+2"`, Lichess uses `"300+0"`. Should the
   parser accept both, or should it require a normalised `baseSeconds +
   incrementSeconds` pair?
3. Should move time evidence be included in the annotated PGN export, or kept
   as a separate enrichment that the export does not carry?
