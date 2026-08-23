# Objective analysis specification

## Invariants

1. Raw UCI scores declare their perspective and are normalized to White POV at the engine boundary.
2. Mate remains distinct from centipawns. Conversion is allowed only inside a documented derived function such as WinPercent.
3. `packages/analysis` owns WinPercent, Accuracy, Divider and classification. UI code may format but not recalculate them.
4. Opening identity/theory and structural game phase are independent results.
5. Classification includes machine-readable evidence and explicit precedence.
6. Objective uniqueness requires MultiPV; the default is three lines.

## Engine result

Each line contains rank, White-POV score, depth, optional nodes and UCI PV. Browser engine-cache keys contain FEN, Stockfish version, depth, MultiPV and any `searchmoves` restriction. The persistent review-cache key additionally contains the algorithm version and normalized game identity.

Full-game browser review first evaluates every position with a pool capped at two workers. If the played move is absent from a root MultiPV result, a second root search restricted with UCI `searchmoves` obtains that move's score. The resulting-position score is never substituted for the played-move root score.

## Dependency order

```text
raw UCI -> score normalization -> WinPercent -> move/game/phase Accuracy
board positions -> Divider -> per-move phase
MultiPV + legal move facts + tactical/sacrifice facts -> classification
```

## Initial algorithm version

The current assembler emits `objective-v1-preview.3`. Accuracy and Divider target upstream compatibility. Classification thresholds are the documented initial product heuristic and may not be silently retuned.

## Sacrifice evidence

The deterministic detector uses a TypeScript swap-off SEE that recomputes attackers after every virtual capture, then replays the played Stockfish root PV. A material offer records net investment, signed SEE from the mover's perspective, compensation implied by the preserved evaluation, whether the line includes and survives the opponent's best response, and material recovered later in the PV. Immediate tactical recovery, unsupported offers, pawn offers and decided/forced/trivial positions cannot become Brilliant.

This is a behavior-level adaptation of the SEE and sacrifice/evidence design studied in `dev-arcturus/positional_chess`, extended with the project's Stockfish best-response/PV facts. It is not a claim of compatibility with a third-party Brilliant classifier.

## Phase 1 presentation

The review graph consumes the canonical per-move White-POV evaluations and displays structural phase boundaries, classification-colored move points and critical moments. Selecting a graph point changes the canonical board ply; the chart does not calculate alternative chess facts.
