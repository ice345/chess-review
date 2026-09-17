# Objective analysis specification

## Invariants

1. Raw UCI scores declare their perspective and are normalized to White POV at the engine boundary.
2. Mate remains distinct from centipawns. Conversion is allowed only inside a documented derived function such as WinPercent.
3. `packages/analysis` owns WinPercent, Accuracy, Divider and classification. UI code may format but not recalculate them.
4. Opening identity/theory and structural game phase are independent results.
5. Classification includes machine-readable evidence and explicit precedence.
6. Objective uniqueness requires MultiPV; persisted classification always starts with three lines, independent of Engine Lab presentation settings.

## Engine result

Each line contains rank, White-POV score, depth, optional nodes and UCI PV. Browser engine-cache keys contain FEN, Stockfish version, depth, MultiPV and any `searchmoves` restriction. The persistent review-cache key additionally contains the algorithm version and normalized game identity.

Full-game browser review evaluates every position with a pool sized from the
device: half its logical cores, at least one and at most four
(`reviewWorkerBudget`), under the lowest scheduler priority. Pool workers are
created on demand, so a short game never compiles engines it cannot use. The
shared scheduler independently permits at most two engine tasks at once, with at
most one background game, reserving capacity for interactive position/variation
work. Parallelism changes only how positions are distributed: each position is
still an independent root search whose restricted played-move search is issued to
the same worker, and scheduling order does not change any score, so a serial and
a four-worker run of the same game produce identical classifications and
Accuracy. The baseline
classification configuration is always MultiPV=3. If the played move is absent,
a second root search restricted with UCI `searchmoves` obtains that move's score.
The independently searched resulting-position score is never substituted for the
played-move root score; their difference is retained as consistency evidence.

The baseline V2 record is passed to a deterministic selective-verification plan.
High-impact annotations, near-threshold qualities, inconsistent roots and
unstable/low-depth candidates are re-searched at least three plies deeper (bounded
to depth 20) with MultiPV=5. At most 12 moves are selected. Stronger before/after
roots and any restricted played-move search rebuild the final persisted result.

A re-searched root replaces shared evidence: the resulting position of a planned
ply is also the root of the following, unplanned ply. Because a deeper MultiPV=5
search is an independent search (each browser search starts from a fresh hash),
it may omit that successor's played move from its candidate list. The verification
pass therefore recomputes restricted `searchmoves` evidence against the final
merged roots — not only against the requested plies — so every played move in the
final rebuild has either a root line or a restricted override. This invariant is
guarded by transport-level and orchestration regression tests.

A checkmate or stalemate position has no legal move, so UCI correctly returns `bestmove (none)` without a principal variation. Full-game orchestration does not search such terminal nodes as ordinary candidate positions. It records an empty terminal PV list and carries forward the preceding Stockfish root score for the actual played move; this preserves the canonical White-POV mate/draw result without inventing a continuation. For a standalone terminal query or zero-ply game with no preceding Stockfish root, the rules layer supplies `0 cp` for stalemate or a signed `mateIn: ±1` terminal sentinel that preserves the winner in the existing score schema.

## Dependency order

```text
raw UCI -> score normalization -> WinPercent -> move/game/phase Accuracy
board positions -> Divider -> per-move phase
MultiPV + legal move facts + tactical/sacrifice facts -> classification
```

## Objective V2 algorithm version

The current assembler emits `objective-v2.0` and `GameAnalysisV2`. It separates
continuous WinPercent-led quality from special annotations and records the
classification/verification engine configuration. V1 caches remain stale data
and cannot enter current player-intelligence reports. Accuracy and Divider are
unchanged and continue to target upstream compatibility. Classification constants
may not be silently retuned.

## Sacrifice evidence

The deterministic detector uses a TypeScript swap-off SEE that recomputes attackers after every virtual capture, then replays the played Stockfish root PV. A material offer records net investment, signed SEE from the mover's perspective, compensation implied by the preserved evaluation, whether the line includes and survives the opponent's best response, and material recovered later in the PV. Immediate tactical recovery, unsupported offers, pawn offers and decided/forced/trivial positions cannot become Brilliant.

This is a behavior-level adaptation of the SEE and sacrifice/evidence design studied in `dev-arcturus/positional_chess`, extended with the project's Stockfish best-response/PV facts. It is not a claim of compatibility with a third-party Brilliant classifier.

## Phase 1 presentation

The review graph consumes the canonical per-move White-POV evaluations and displays structural phase boundaries, classification-colored move points and critical moments. Selecting a graph point changes the canonical board ply; the chart does not calculate alternative chess facts.

## Tablebase boundary

A Syzygy lookup exists as an Engine Lab tool: the **Tablebase** tab in the review
Engine/Explorer/Tablebase panel asks `GET /api/tablebase` for the current position,
which proxies the public seven-piece tables and returns the normalized
`TablebasePositionV1` contract owned by `packages/tablebase`. It is a manual
position lookup, hidden while an answer is owed, and no canonical analysis consumes
it.

It is therefore not classification proof. Endgame classification, Accuracy,
move quality and player-intelligence/Training metrics read Stockfish search only,
and a Stockfish score for a position with seven or fewer pieces must not be
described as a tablebase-proven win, draw, loss, conversion or save — no matter how
large it is. A later correctness enhancement may add a versioned tablebase fact
(`TablebaseEvidenceV1`) containing WDL/DTZ, exact position identity, tablebase
source/version and availability/fallback state. It must remain distinct from cp and
mate scores and would require fixtures before affecting classification or
player-intelligence claims.
