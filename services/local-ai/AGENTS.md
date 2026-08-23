# Local AI Service Instructions

This directory contains optional enhanced local capabilities.

Primary responsibilities:

- Maia-3 human chess analysis
- Ollama / LLM coaching
- optional native chess-engine adapters

This service enriches the browser analysis system.

It must not become an undocumented replacement for deterministic
chess-core behavior.

---

# Service Stack

Preferred stack:

- Python
- FastAPI
- Pydantic
- python-chess

Use Maia-3 for human move modeling.

Use provider adapters for LLM access.

---

# Maia Role

Maia models human chess behavior.

Maia answers questions such as:

- What move might a player at this Elo choose?
- How likely is the played move?
- What candidate moves are natural for humans?
- How surprising is the Stockfish best move for this Elo?

Maia does NOT answer:

- What is objectively the best move?
- Is this objectively a blunder?
- What is the canonical engine evaluation?

Those remain Stockfish/core responsibilities.

---

# Maia Inputs

Keep rating information explicit.

Relevant concepts may include:

- target Elo
- self Elo
- opponent Elo
- model version
- temperature
- TopP
- MultiPV or candidate count

Do not hide model configuration in global mutable state.

---

# Maia Outputs

Prefer structured results containing:

- model identity/version
- target Elo
- move candidates
- move probabilities
- played-move probability
- human WDL where supported

Do not convert Maia probabilities into unsupported claims such as:

"Only exactly 3.7% of all real 1400 players would find this move."

Phrase these values as model predictions.

---

# Human Difficulty

Human Find Difficulty is an application-level heuristic.

Maia probability may contribute to it.

Do not label the result as:

- FIDE difficulty
- official Chess.com difficulty
- objective engine strength

without supporting evidence.

---

# LLM Role

The LLM is a renderer and coach.

The LLM must consume structured chess facts.

It must not be the canonical source for:

- legal moves
- evaluation
- mate
- best move
- move classification
- opening identity
- game phase
- tactical truth

---

# LLM Input

Prefer structured context containing fields such as:

- FEN before
- FEN after
- SAN
- UCI
- phase
- opening
- objective evaluation
- best candidates
- PV
- classification
- classification evidence
- tactical motifs
- material facts
- Maia candidate probabilities
- player Elo

Do not send only a FEN and ask the LLM to invent an analysis.

---

# LLM Output

Prefer validated structured responses.

Conceptual fields may include:

- headline
- summary
- whyMoveWorks
- whatWentWrong
- betterPlan
- humanPerspective
- tacticalIdea
- trainingTip
- confidence

Keep the schema versioned where persisted.

---

# Chess Move Validation

Any concrete chess move suggested by an LLM must be validated before
being presented as a factual continuation.

Use python-chess or the canonical chess rules layer.

If a suggested continuation is illegal:

- discard or regenerate it
- do not silently display it

LLM prose that contradicts objective engine facts must not override the
engine result.

---

# Providers

Keep LLM integration provider-independent.

Initial targets:

- Ollama
- OpenAI-compatible endpoints

The local default may use:

gemma4:12b-it-qat

Do not scatter Ollama-specific HTTP logic throughout domain code.

Use a provider interface.

---

# Ollama

Assume local Ollama is optional.

Failure to connect to Ollama should not break core game analysis.

The UI/service should report the coach as unavailable while preserving
Stockfish review functionality.

Do not require cloud API credentials for local mode.

The repository development launcher may probe the Ollama HTTP API and
reuse a service that is already running. If no API is available, it may
locate the installed executable and run `ollama serve`; it must never
use `ollama run` for service startup.

Model availability and service availability are separate health states.
Never pull or download a model without explicit user approval. Report the
exact setup command instead. Track process ownership and terminate only
children created by the active launcher.

---

# Privacy

Local analysis should remain local by default when using:

- local Maia
- Ollama

Do not upload PGNs or analysis data to third-party APIs
without an explicitly selected provider or user action.

---

# Resource Usage

Maia, Stockfish, and LLM workloads can compete for resources.

Avoid unnecessary parallel execution.

LLM explanation should normally be lazy.

Recommended sequence:

objective analysis available
-> optional Maia enrichment
-> coach explanation on demand

---

# API Design

Prefer typed/versioned request and response schemas.

Keep endpoints narrow.

Conceptual API areas:

- health
- Maia analysis
- coach explanation
- coach game summary

Do not expose internal model implementation details unnecessarily to
the web frontend.

---

# Errors

Return structured errors.

Differentiate failures such as:

- model unavailable
- invalid FEN
- Ollama unavailable
- provider authentication failure
- LLM invalid structured output

Do not collapse every failure into HTTP 500 with an opaque string.

---

# Tests

Important tests include:

- Pydantic validation
- invalid FEN
- Maia response normalization
- probability normalization
- provider failures
- malformed LLM output
- illegal LLM move validation

Mock expensive model execution where appropriate.

Use a small number of real integration tests separately.

---

# Completion Requirements

Before finishing changes here:

- run relevant Python tests
- verify schema compatibility
- verify browser mode remains independent when applicable
- verify no secrets were committed
- verify failures degrade gracefully
- update related documentation
