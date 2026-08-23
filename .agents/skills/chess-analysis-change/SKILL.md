---
name: chess-analysis-change
description: Use when implementing, debugging, reviewing, or changing chess-analysis behavior in this repository, especially Stockfish evaluation, WinPercent, Accuracy, opening/middlegame/endgame division, move classification, Brilliant/Great detection, MultiPV logic, sacrifice detection, critical moments, or analysis regression tests. Do not use for purely visual UI work that does not change chess-analysis semantics.
---

# Chess Analysis Change

Use this workflow whenever a task may alter chess-analysis semantics.

The purpose of this skill is to prevent accidental algorithm drift.

---

# 1. Identify the Algorithm

Before editing code, state which analysis subsystem is involved.

Examples:

- Stockfish transport
- score normalization
- mate handling
- WinPercent
- move Accuracy
- game Accuracy
- phase Accuracy
- Divider
- opening recognition
- move classification
- Brilliant
- Great
- sacrifice detection
- tactical motifs
- critical moments
- human difficulty

If multiple systems interact, identify their dependency order.

---

# 2. Read Project Rules

Read the applicable:

- root AGENTS.md
- packages/analysis/AGENTS.md
- relevant documentation under docs/

Do not rely only on conversation context.

For algorithm work, inspect at least the relevant documentation such
as:

- docs/analysis-spec.md
- docs/accuracy.md
- docs/game-phases.md
- docs/move-classification.md
- docs/data-model.md

when those files exist.

---

# 3. Inspect Current Implementation

Before changing behavior:

- locate the canonical implementation
- locate the public types
- locate tests
- locate consumers
- identify persisted/cache formats affected

Do not create a second implementation because the existing one is
difficult to find.

Search first.

---

# 4. Establish Current Behavior

Determine what the code currently does.

For bug fixes:

create or identify a failing regression case before rewriting the
algorithm whenever practical.

For refactors:

ensure existing behavioral tests pass before changing structure.

For semantic changes:

document the intended before/after behavior.

---

# 5. Consult Upstream References When Relevant

Research upstream code when the algorithm is based on an external
open-source implementation.

Likely references:

## Accuracy

- lichess-org/lila
- AccuracyPercent.scala

## WinPercent

- lichess-org/scalachess
- eval.scala

## Game phases

- lichess-org/scalachess
- Divider.scala

## Openings

- lichess-org/chess-openings

## Baseline move classification

- cooperbuilds/chess-game-analyzer

## Brilliant / sacrifice ideas

- dev-arcturus/positional_chess
- cooperbuilds/chess-game-analyzer

## Objective engine

- official-stockfish/Stockfish

Do not assume a remembered implementation is current.

If the local references directory contains the relevant repository,
inspect that copy.

If freshness matters and network access is available, verify upstream
behavior.

---

# 6. Preserve Core Invariants

Before implementation, check these invariants.

## Evaluation

- one canonical internal POV
- explicit POV conversion
- mate is distinct from cp

## Accuracy

- one canonical WinPercent implementation
- one canonical game Accuracy implementation
- phase Accuracy reuses canonical Accuracy behavior

## Game Phase

- structural division
- not fixed move-number boundaries

## Opening

- theory recognition is separate from game-phase detection

## Classification

- classification has structured evidence
- precedence is explicit

## Human Analysis

- Maia does not override objective engine truth

## LLM

- LLM does not determine canonical chess facts

---

# 7. MultiPV Analysis

When a feature depends on move uniqueness, inspect MultiPV rather than
only top-1.

Relevant concepts include:

- played move rank
- top candidate
- second-best candidate
- evaluation gap
- win-probability gap

Do not call a move "only move" merely because Stockfish returned one
PV.

Distinguish:

- only legal move
- only reasonable move
- objectively critical best move

---

# 8. Brilliant Changes

When touching Brilliant logic, explicitly evaluate:

- was the played move objectively strong?
- was material genuinely invested?
- can the opponent accept the sacrifice?
- what happens after the opponent's best response?
- is material immediately recovered?
- is compensation tactical, positional, or mating?
- was the move forced?
- was it an obvious recapture?
- was the position already trivially won?

Do not reduce Brilliant to one numeric threshold.

Return evidence.

---

# 9. Great Changes

When touching Great logic, explicitly inspect:

- engine rank
- top-1 versus top-2 gap
- top-1 versus top-3 gap if relevant
- legal move count
- whether the move is forced
- whether alternatives materially change the game
- whether the move is trivial

Great should mean a critical strong choice, not simply another synonym
for Best.

---

# 10. Accuracy Changes

When touching Accuracy:

compare behavior against the documented Lichess-compatible algorithm.

Check:

- WinPercent conversion
- per-move Accuracy
- volatility handling
- weighted mean
- harmonic mean
- player-color filtering
- phase slicing
- short-game behavior

Never silently replace the algorithm with arithmetic mean.

---

# 11. Divider Changes

When touching game phases, test games that defeat naive move-number
heuristics.

Include cases such as:

- early queen exchange
- fast simplification
- closed position
- long theory line
- delayed development
- tactical opening
- early endgame

Compare middlePly and endPly behavior rather than only final labels.

---

# 12. Opening Changes

When touching opening recognition:

test transpositions.

Do not assume identical openings always share identical move-string
prefixes.

Keep these separate:

- opening identity
- theory boundary
- structural game phase

---

# 13. Add Regression Fixtures

Each meaningful bug fix should add a fixture when practical.

A useful fixture should include enough information to explain why the
expected behavior exists.

Possible fields:

- PGN
- FEN
- played move
- engine candidates
- expected evaluation
- expected phase
- expected Accuracy
- expected classification
- expected classification evidence

Prefer real chess positions over artificial numeric-only tests when the
board state matters.

---

# 14. Implement the Narrowest Correct Change

Avoid rewriting unrelated analysis modules.

Prefer:

small behavioral change
+
test
+
documentation

over:

large cleanup
+
hidden semantic changes

If a larger refactor is necessary, separate behavior-preserving work
from semantic changes where practical.

---

# 15. Check Data Compatibility

Before changing public analysis types, inspect:

- cached analysis
- IndexedDB
- JSON export
- annotated PGN export
- UI consumers
- API schemas
- persisted version fields

If semantics materially change, determine whether the analysis schema
or algorithm version needs to change.

---

# 16. Run Validation

Use actual repository scripts.

Do not invent commands.

Run, as applicable:

- focused unit tests
- full analysis-package tests
- TypeScript type checking
- lint
- build
- Python tests if local-ai integration changed

For compatibility ports, compare numeric results within an explicit
floating-point tolerance.

---

# 17. Review the Final Diff

Before completion, inspect the diff for:

- accidental constant changes
- unexplained threshold changes
- duplicated formulas
- hidden POV conversion
- missing tests
- stale documentation
- unrelated refactors
- generated files

---

# 18. Update Documentation

If behavior changed, update the relevant documentation.

Document:

- what changed
- why
- algorithm or heuristic
- known limitations
- upstream reference when relevant

Never leave docs describing an algorithm that the code no longer uses.

---

# 19. Final Report

When reporting completion, include:

- subsystem changed
- previous behavior
- new behavior
- algorithmic reason
- tests added or changed
- validation actually run
- remaining limitations

For algorithm changes, explicitly mention whether results are intended
to remain compatible with upstream behavior.

---

# Principle

Chess-analysis code is product behavior.

Treat changes to:

Accuracy,
game phases,
evaluation normalization,
Brilliant,
Great,
classification,
and human difficulty

with the same care as changes to a public API.
