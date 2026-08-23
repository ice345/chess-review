# Accuracy

Implementation: `packages/analysis/src/accuracy.ts`. Upstream: current `lila` `AccuracyPercent.scala` at research commit `5b90515`.

## WinPercent input

Accuracy consumes the single canonical WinPercent conversion documented in `game-phases.md`/`analysis-spec.md`: CP is clamped to ±1000, then mapped using the scalachess logistic curve. Mate maps to the signed CP ceiling.

## Move accuracy

If the mover's WinPercent did not fall, accuracy is 100. Otherwise:

```text
winDiff = before - after
raw = 103.1668100711649 * exp(-0.04354415386753951 * winDiff)
      - 3.166924740191411
accuracy = clamp(raw + 1, 0, 100)
```

The `+1` is the upstream uncertainty bonus.

## Game accuracy

1. Prepend the upstream initial evaluation of +15 cp.
2. Convert every evaluation to WinPercent.
3. Select window size `clamp(floor(numberOfPlies / 10), 2, 8)`.
4. Compute each window's population standard deviation and clamp it to `[0.5, 12]` as the move weight.
5. For each color, compute the volatility-weighted mean and the harmonic mean of move accuracies. The selected `scalalib` implementation uses `1 / max(1, accuracy)` in the harmonic denominator, so a zero-accuracy move is floored to one for this aggregation.
6. Return `(weightedMean + harmonicMean) / 2`.

Empty and one-ply games have no two-color game accuracy, matching current upstream tests. Missing evaluations are skipped only where upstream `Option` values would prevent a sample.

## Phase accuracy

Phase slices call the same `gameAccuracy()` implementation. There is no arithmetic-mean shortcut. Changes require numeric compatibility tests and documentation.
