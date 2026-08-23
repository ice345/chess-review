# Analysis Package Instructions

This directory contains product-critical chess-analysis algorithms.

Changes here require a higher correctness standard than ordinary UI
changes.

---

# Scope

This package is responsible for concepts such as:

- WinPercent
- move Accuracy
- game Accuracy
- phase Accuracy
- opening / middlegame / endgame division
- move classification
- classification evidence
- Brilliant detection
- Great detection
- sacrifice analysis
- critical moments
- tactical evidence

Do not place React or presentation-specific logic here.

---

# Determinism

Core analysis should be deterministic for identical inputs and
configuration.

Avoid hidden dependencies on:

- current time
- random values
- UI state
- network state
- LLM output

unless a feature explicitly requires them.

---

# Engine Evaluation

Never assume a raw numeric engine value has an obvious perspective.

All engine evaluations entering this package must have an explicitly
defined perspective.

Canonical internal evaluation should use White POV unless the shared
schema documents otherwise.

Do not perform invisible sign inversions.

Use named conversion functions.

---

# Mate Scores

Mate values are semantically different from centipawn values.

Do not treat mate scores as arbitrary large cp values in domain logic
unless a specific documented conversion requires it.

Classification logic must correctly handle transitions involving:

- mate found
- mate lost
- mate delayed
- opponent mate
- centipawn-to-mate transition
- mate-to-centipawn transition

Add tests for these cases.

---

# WinPercent

There must be one canonical engine-score-to-WinPercent implementation.

The target behavior follows the documented Lichess/scalachess port.

Do not create alternative logistic formulas in unrelated modules.

If the canonical function changes:

- document why
- update compatibility fixtures
- inspect downstream Accuracy behavior

---

# Accuracy

Accuracy must follow the documented Lichess-compatible implementation.

Do not simplify game Accuracy to:

average(moveAccuracy)

unless the product specification explicitly changes.

Preserve the concepts used by the selected upstream behavior,
including where applicable:

- per-move WinPercent loss
- volatility
- windowed weighting
- weighted mean
- harmonic mean

Numerical constants are part of the algorithm.

Do not tune them casually.

---

# Accuracy Tests

Accuracy changes require tests covering:

- equal positions
- tiny evaluation changes
- decisive blunders
- winning positions
- losing positions
- mate transitions
- short games
- long games
- highly volatile games
- quiet games

Where upstream fixtures are available, preserve compatibility to an
explicit numeric tolerance.

---

# Game Division

Game division should follow the documented TypeScript port of the
current selected scalachess Divider behavior.

Do not replace structural phase detection with move-number thresholds.

Phase boundaries must be represented by ply, not ambiguous human move
numbers.

Test unusual games such as:

- early queen trade
- long closed opening
- rapid simplification
- delayed development
- early tactical chaos
- rook endgame
- pawn endgame

---

# Opening Theory Is Separate

Do not use ECO/theory recognition as the sole game-phase detector.

These are different questions:

"Is this position still part of known opening theory?"

and

"Is this structurally still the opening phase?"

Both may appear in the product simultaneously.

---

# Classification

Classification is a pure analysis result.

Every classified move must expose its evidence.

Prefer a result shaped around:

- classification
- cp loss
- WinPercent before
- WinPercent after
- engine rank
- MultiPV gap
- is forced
- is book
- sacrifice evidence
- tactical evidence
- exclusion reasons

UI wording should be derived from this evidence.

---

# Classification Order

Classification rules may overlap.

Therefore precedence must be explicit and tested.

Do not rely on accidental source-code ordering without documenting it.

Special semantic classes such as:

- book
- forced
- missed mate
- missed win
- brilliant
- great

must define how they interact with ordinary quality bands.

---

# Brilliant

Brilliant must require meaningful positive evidence.

Do not infer brilliance solely because:

- the move is best
- the moved piece can be captured
- cp loss is zero

The detector should distinguish genuine investment from:

- obvious recapture
- temporary attack with immediate material recovery
- already-decided positions
- meaningless hanging material
- forced moves

Return evidence rather than only a boolean.

---

# Great

Great should represent a critical high-quality choice.

MultiPV comparison is central.

Distinguish:

- only legal move
- forced response
- objectively unique critical move

These are not automatically the same thing.

---

# Human Difficulty

Do not use Maia probabilities inside objective classification unless
the product specification explicitly defines such a relationship.

Keep:

objective move quality

and

human find difficulty

as separate outputs.

---

# LLM Boundary

No LLM calls belong in the core classification or Accuracy algorithms.

An LLM may explain an already-computed result elsewhere.

It may not determine whether a move is:

- best
- brilliant
- great
- mistake
- blunder

inside this package.

---

# Upstream Ports

When porting behavior from repositories such as:

- lichess-org/lila
- lichess-org/scalachess
- cooperbuilds/chess-game-analyzer
- dev-arcturus/positional_chess

record:

- upstream repository
- relevant file
- relevant function or concept
- important intentional deviations

Prefer behavioral ports over superficial syntax translation.

---

# Tests Before Refactors

Before materially refactoring an existing algorithm:

1. understand current behavior
2. create or inspect regression fixtures
3. run them before the change
4. perform the refactor
5. run them afterward

Do not refactor algorithm code based only on aesthetic preference.

---

# Algorithm Versioning

If persisted analysis results depend on algorithm behavior, consider
whether an algorithm-version field must change.

Old cached analysis must not silently masquerade as results generated
by a substantially different algorithm.

---

# Completion Requirements

For meaningful changes in this package:

- implementation is complete
- focused tests pass
- regression tests pass
- relevant documentation is updated
- constants and semantics are explained
- final diff has been inspected
