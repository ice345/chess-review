# AGENTS.md

## Project

This repository implements an open-source chess review and coaching platform.

The product combines ideas from:

- Chess.com Game Review
- Lichess Analysis
- WintrChess
- Stockfish
- Maia-3
- local or API-based LLM coaching

The goal is NOT to create another simple Stockfish frontend.

The core product idea is:

Objective Chess Analysis
+
Human Chess Analysis
+
Explainable AI Coaching

---

# Core Architecture

The system has three conceptually separate layers.

## 1. Objective chess truth

Primary source:

- Stockfish

Responsible for:

- evaluation
- mate detection
- best move
- MultiPV candidates
- principal variations
- tactical correctness
- objective move quality

Stockfish is the canonical objective engine unless a documented
architecture decision explicitly changes this.

---

## 2. Human chess behavior

Primary source:

- Maia-3

Responsible for:

- human move probability
- Elo-conditioned move prediction
- human WDL estimates
- natural candidate moves
- human find difficulty

Maia is NOT an objective chess evaluator.

Never use Maia output to replace Stockfish evaluation or objective
move classification.

---

## 3. Natural-language coaching

Primary sources may include:

- local Ollama models
- OpenAI-compatible APIs
- other configured LLM providers

The LLM is an explanation layer.

The LLM MUST NOT be treated as a chess truth source.

Chess facts must come from deterministic chess logic, Stockfish,
Maia, opening data, tactical detectors, or other explicitly defined
analysis modules.

The preferred pipeline is:

engine/core facts
-> structured analysis data
-> LLM
-> explanation

Never use:

FEN
-> LLM
-> unverified chess analysis

as the canonical analysis pipeline.

---

# Source of Truth

The canonical data model belongs in the shared/core analysis packages.

UI components must consume canonical analysis data rather than
reconstructing chess analysis independently.

Do not duplicate:

- score normalization
- win probability conversion
- accuracy formulas
- game-phase detection
- move classification logic
- opening recognition

inside React components.

---

# Engine Score Convention

Engine score perspective is a critical invariant.

Internally normalize engine evaluations to:

WHITE POINT OF VIEW

unless a documented module explicitly requires another representation.

Do not silently switch between:

- side-to-move POV
- engine POV
- player POV
- white POV

Every conversion must be explicit.

Prefer typed score structures.

Example conceptual representation:

EngineScore =
- centipawn score
- mate score

Mate scores must not be treated as ordinary centipawn values unless
a specifically documented transformation requires it.

---

# Accuracy

The target accuracy implementation follows the behavior of the
current Lichess open-source implementation.

Relevant upstream concepts include:

- WinPercent
- AccuracyPercent.fromWinPercents
- gameAccuracy
- phaseAccuracies
- volatility weighting
- weighted mean
- harmonic mean

Do NOT replace this with a simple arithmetic mean unless explicitly
requested.

Changes to Accuracy behavior require:

1. explanation of the algorithmic change
2. regression tests
3. comparison against known fixtures
4. documentation update

Do not silently tune Accuracy constants.

---

# Game Phase Detection

Opening / middlegame / endgame division should follow the documented
port of the Lichess/scalachess Divider behavior.

Do NOT classify phases using fixed move-number ranges such as:

- moves 1-10 = opening
- moves 11-30 = middlegame
- moves 31+ = endgame

Game phase and opening theory are separate concepts.

Game phase:

- opening
- middlegame
- endgame

Opening theory recognition:

- ECO
- opening name
- variation
- known theoretical position
- theory boundary

Do not conflate these systems.

---

# Opening Recognition

Use normalized opening data derived from:

lichess-org/chess-openings

Opening recognition should be position-based where appropriate and
must handle transpositions.

Do not rely exclusively on raw PGN string-prefix matching.

---

# Move Classification

Canonical classifications currently include:

- brilliant
- great
- best
- excellent
- good
- book
- interesting
- forced
- inaccuracy
- mistake
- blunder
- miss
- missed_win
- missed_mate

Every classification result must include machine-readable evidence.

Do not return only:

classification = "brilliant"

Prefer a result conceptually equivalent to:

classification = brilliant
reason =
- engine rank
- centipawn loss
- win-probability loss
- sacrifice evidence
- MultiPV gap
- tactical evidence
- relevant exclusions

The UI must be able to answer:

"Why did this move receive this label?"

without asking an LLM to invent the explanation.

---

# Brilliant Moves

Brilliant detection must not be implemented as:

best move + hanging moved piece

alone.

A Brilliant candidate should consider evidence such as:

- engine-best or near-best status
- evaluation preservation or improvement
- real material investment
- static exchange evaluation where available
- opponent best response
- compensation
- tactical continuation
- whether material is immediately recovered
- whether the move is merely an obvious recapture
- whether the position was already trivially winning

Brilliant classification must remain explainable.

Changes require regression tests.

---

# Great Moves

Great moves are primarily critical-move or only-move concepts.

Use MultiPV information.

A move may become a Great candidate when:

- it is the best objective move
- alternatives are substantially worse
- the position is meaningfully affected by choosing another move

Exclude trivial cases where possible:

- only legal move
- obvious forced recapture
- trivial check evasion
- automatic move with no meaningful choice

Changes require regression tests.

---

# Human Find Difficulty

Human Find Difficulty is distinct from objective move quality.

For example:

Objective quality:
Best

Human difficulty:
Very Hard

may both be true.

Inputs may include:

- Maia move probability
- player Elo
- MultiPV gap
- legal move count
- forcing nature
- tactical complexity
- sacrifice characteristics

Do not present this metric as an official Elo measurement.

Label experimental heuristics clearly.

---

# AI Coach Grounding

LLM prompts must receive structured analysis facts.

Prefer fields such as:

- FEN before
- FEN after
- SAN
- UCI
- game phase
- classification
- classification evidence
- evaluation before
- evaluation after
- MultiPV
- PV
- opening
- material
- tactical motifs
- Maia probabilities
- player target Elo

If the LLM emits chess moves, validate them using chess rules before
showing them as factual continuations.

Do not allow the LLM to override engine facts.

If structured evidence is insufficient, the coach should communicate
uncertainty instead of inventing details.

---

# Import Boundary

Product input is PGN or explicit FEN. Screenshot/image OCR import is not
part of the product roadmap.

PNG export remains supported for reviewed positions and whole-game
review cards. Do not conflate export rendering with image import.

---

# Browser Mode and Local Mode

The project supports two conceptual modes.

## Browser Mode

Should remain usable without the local AI service where practical.

Expected capabilities:

- PGN
- FEN
- Stockfish WASM
- move review
- classification
- accuracy
- phases
- opening recognition
- charts

## Enhanced Local Mode

May provide:

- Maia-3
- Ollama
- native Stockfish

Browser-only functionality must not accidentally depend on the
local service unless the feature explicitly requires it.

---

# LLM Providers

Keep the coach provider-agnostic.

Initial preferred providers:

- Ollama
- OpenAI-compatible API

The local default may use:

gemma4:12b-it-qat

Do not hard-code one provider throughout application code.

Use a provider abstraction.

---

# Repository Boundaries

Intended responsibility:

apps/web
- application shell
- routes
- composition
- browser UX

apps/desktop
- reserved for the Phase 6 Vite + React + Tauri 2 shell
- native window, sidecar and file-open integration only
- reuse canonical packages; do not copy analysis semantics

packages/chess-core
- chess-domain primitives
- normalized game and position structures
- deterministic chess utilities

packages/analysis
- accuracy
- game phases
- move classification
- tactical evidence
- critical moments

packages/stockfish
- Stockfish transport
- workers
- UCI parsing
- engine cache
- MultiPV

packages/openings
- ECO/opening dataset
- opening recognition
- theory-boundary detection

packages/shared
- cross-package schemas and utilities

packages/ui
- reusable visual components
- chess review visual language
- quality icons

services/local-ai
- Maia
- Ollama/provider integration
- optional native engines

Keep these boundaries unless there is a strong documented reason to
change them.

---

# Local Runtime Ownership

`pnpm dev` is the managed full local-development entry point.
`pnpm dev:web` is the explicit Browser Core-only alternative.

The development launcher may reuse an existing Ollama or local-ai
service. It must stop only processes it started. Start Ollama with
`ollama serve`, never `ollama run`, and never download a model without
explicit user approval. A missing configured model is a setup state,
not permission to execute `ollama pull`.

---

# Reference Repositories

Research repositories may be cloned under:

references/

This directory is research material and should normally remain outside
the production build.

Important references include:

- cooperbuilds/chess-game-analyzer
- WintrCat/wintrchess
- lichess-org/lila
- lichess-org/scalachess
- lichess-org/chess-openings
- official-stockfish/Stockfish
- CSSLab/maia3
- CSSLab/maia-platform-frontend
- dev-arcturus/positional_chess
- imutkarsht/Chess_analyzer
- SikamikanikoBG/patzer
- SailingSF/chesslens-core

When implementing an algorithm based on a reference project:

1. identify the relevant upstream file/function
2. understand the behavior
3. document what is being ported or adapted
4. add tests
5. keep the implementation consistent with our architecture

Do not blindly copy large unrelated sections of a reference repository.

Do not spend implementation time debating licensing unless the user
specifically asks; record relevant provenance in project documentation
and continue the requested engineering work.

---

# Documentation

Before changing major algorithms, inspect relevant documentation under:

docs/

Especially:

- architecture.md
- analysis-spec.md
- accuracy.md
- game-phases.md
- move-classification.md
- human-analysis.md
- ai-coach.md
- data-model.md
- roadmap.md
- research.md

If implementation changes documented behavior, update the corresponding
documentation in the same change.

Documentation must describe actual behavior, not aspirational behavior.

---

# Testing Philosophy

Algorithm changes require deterministic tests.

Important regression areas:

- PGN parsing
- FEN handling
- score POV conversion
- mate normalization
- WinPercent conversion
- move Accuracy
- game Accuracy
- phase Accuracy
- Divider behavior
- opening transpositions
- classification thresholds
- Great detection
- Brilliant detection

Prefer fixtures derived from real positions and games.

For ports of upstream algorithms, include compatibility fixtures where
practical.

Do not weaken a test merely to make a new implementation pass unless
the intended behavior has deliberately changed and is documented.

---

# Validation

Before finishing a code change:

1. inspect repository scripts rather than inventing commands
2. run the narrowest relevant tests while developing
3. run the relevant package test suite
4. run type checking where applicable
5. run linting where applicable
6. verify production build when the change can affect integration
7. inspect the final diff

If a command does not exist yet, do not fabricate it.

Report which checks were actually run.

---

# Package Management

Use pnpm for JavaScript/TypeScript workspace management unless the
repository has deliberately migrated to another package manager.

Do not mix npm, yarn, and pnpm lockfiles.

Python dependencies for local-ai should be managed consistently with
the Python project configuration chosen by the repository.

---

# Dependency Policy

Before introducing a new production dependency:

- check whether the repository already provides equivalent functionality
- prefer maintained dependencies
- explain why the dependency is needed
- avoid dependencies for trivial utilities

Do not add a large framework merely to solve a small local problem.

---

# Performance

Full-game analysis is computationally expensive.

Prefer this progression:

parse game
-> Stockfish analysis
-> objective review becomes usable
-> Maia enrichment
-> LLM explanation on demand

Do not automatically run LLM explanations for every move.

Do not run Stockfish, Maia, and LLM workloads concurrently without
considering CPU/GPU/memory contention.

Use caching where analysis is deterministic.

Cache keys must include algorithmically relevant parameters such as:

- FEN
- engine version
- depth
- MultiPV

---

# UI Principles

The UI should make objective facts, human behavior, and coaching
visually distinguishable.

Do not visually blur:

Stockfish evaluation
Maia prediction
LLM explanation

into one unexplained score.

Move-quality icons should use our own coherent SVG visual language.

The same classification semantics should be reused across:

- board overlay
- move list
- summary
- charts
- image export

Do not implement separate classification meanings for different views.

---

# Git Discipline

Keep changes focused.

Do not rewrite unrelated files.

Do not perform broad refactors while implementing an unrelated feature
unless required for correctness.

Prefer logical commits when committing is requested or appropriate.

Before claiming completion:

- inspect git diff
- check unexpected generated files
- check accidental reference-repository additions
- check large binaries

references/ should normally be ignored by Git unless explicitly
requested otherwise.

---

# Working Style

For non-trivial work:

1. inspect current repository state
2. read relevant docs
3. inspect relevant tests
4. inspect upstream reference implementations if needed
5. state the implementation approach
6. implement
7. test
8. inspect diff
9. update documentation
10. summarize behavior and remaining limitations

Do not stop after writing a plan when implementation is clearly
requested and can proceed.

Prefer solving the actual task over producing speculative architecture
documents that are never reflected in code.

---

# Important Rule

Never silently change the semantics of:

- Accuracy
- game phases
- WinPercent
- score POV
- classification
- Brilliant
- Great
- human difficulty

These are product algorithms.

Any meaningful semantic change requires:

implementation
+
tests
+
documentation
+
explicit description in the final work summary
