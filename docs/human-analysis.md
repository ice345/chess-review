# Human analysis

Maia-3 is an optional model of Elo-conditioned human behavior. It does not change Stockfish evaluation, Accuracy or objective classification.

The FastAPI adapter has two non-interchangeable contracts. `MaiaMoveReview` is rooted at one canonical move's `fenBefore` plus its played UCI and returns exact played-move probability, policy rank and played-move WDL. `MaiaPositionAnalysis` is rooted at the exact FEN currently displayed and returns root human-game WDL, policy candidates and a bounded set of candidate WDL values. Both record model identity, target/self/opponent Elo and candidate probability mass. Maia3-5M is the CPU-friendly default; 23M and 79M are real selectable tiers.

Maia-3 is an optional direct dependency pinned to the reviewed official Git revision `1e13597c42d4858b7cfd7cfdae01e297263364b2`. `services/local-ai/uv.lock` preserves that commit. Install and run it with:

```sh
cd services/local-ai
uv sync --extra dev --extra maia
uv run --extra maia uvicorn chess_review_local_ai.main:app --host 127.0.0.1 --port 8000
```

The provider imports Maia lazily and uses CPU without AMP by default. It never downloads a checkpoint during analysis. `/health` reports `available`, `not-installed` or `error` plus `maiaModels` state for all three tiers. Selecting a tier changes settings only; an uncached tier returns a structured `409 maia-model-not-cached` setup state. The user must explicitly call `/maia/models/{model}/download` through the Settings or Review download action. The service keeps at most one resident Maia network and releases the previous network before allocating a different tier.

The setup POST is a privileged local mutation. It requires an allowed localhost
browser Origin and a strict JSON `{ "confirm": true }` body in addition to the
UI's explicit action. This blocks ordinary cross-site form posts; a per-launch
service capability remains the stronger long-term identity boundary described
in the release audit.

In Review, candidate arrows are visual guidance only. A branch is selected from an explicit Maia candidate row whose identity includes the root FEN, model, target Elo and full UCI move; destination-square clicks never guess between candidates that share a landing square. Compare mode marks overlap only when Stockfish and Maia recommend the same full UCI move.

Product code calls `/maia/move-review` and `/maia/position-analysis`. `/maia/moves` remains a deprecated compatibility adapter and must not be used to infer whether a response describes the played move or the displayed position.

At the repository root, `pnpm dev` manages web plus optional local services. If Next.js is already running, `pnpm dev:local-ai` starts or reuses only FastAPI/Ollama. A browser cannot start native processes itself; while offline the Human UI polls `/health` every five seconds and on window focus, then reconnects automatically.

One root forward pass produces logits for every legal move and root value logits. This makes `playedMoveProbability` and `playedMoveRank` exact even when the played move falls outside displayed Top-K. A second bounded value batch contains the union of Maia Top-K, caller-supplied Stockfish comparison moves and the played move, with duplicates removed. It does not run all-legal-move MultiPV value inference. `candidateProbabilityMass` makes it explicit that a Top-K list need not sum to one. `rootWdl` always belongs to the exact displayed root from the side-to-move perspective; `playedMoveWdl` belongs to the reviewed mover; candidate `wdl` belongs to the player choosing that candidate.

Human WDL and the UCI-compatible centipawn field emitted by Maia are not Stockfish evaluation. UI labels must say “Maia model prediction” rather than implying an observed population frequency.

## Review analysis selector

Review exposes three analysis modes without merging their facts:

- **Stockfish** shows ranked MultiPV arrows in the objective blue family.
- **Maia** shows ranked candidate-policy arrows in a separate sage family,
  conditioned on the selected target Elo.
- **Compare** preserves Stockfish as the objective primary source while adding
  Maia candidates, a human-game marker and explicit agreement/disagreement.

The preferred target Elo and model are stored in application settings and reused
across reviews. Position output is runtime-only and keyed by exact FEN, target Elo
and model. Move output is accepted only when `fenBefore`, played UCI, target Elo
and model match the canonical move identity, then persisted as `human-v2` on that
move in the IndexedDB analysis record. Changing Elo/model clears incompatible
runtime and stored human enrichments before a new request completes. A branch
position has no invented “played move” probability.

Selecting a Maia candidate creates a legal analysis-tree edge with Maia target
Elo and probability as source evidence. It does not attach an objective label.
The first Stockfish and Maia recommendations are compared explicitly as agreement
or disagreement; no blended score is calculated. The evaluation bar is
source-aware: Stockfish uses canonical WinPercent, Maia uses root human-game WDL
converted from side-to-move to White presentation, and Compare keeps Stockfish as
the bar while adding a Maia marker.

There is no separate Human Lab route. Target Elo, candidate mass, played-move
probability and Stockfish/Maia comparison live directly in Review when Maia or
Compare is selected. Objective Move Quality and Human Find Difficulty appear as
separate verdicts; one never changes the other. The board destination badge
always remains the objective Stockfish Move Quality icon in Stockfish, Maia and
Compare modes; Maia difficulty stays in its separate evidence surface. When Maia is offline, Browser
Stockfish remains available immediately;
five-second health polling reconnects without a page refresh.

## Human Find Difficulty

Human Find Difficulty remains a deterministic analysis-package heuristic with labels Natural, Findable, Hard, Very Hard and Exceptional. It is not official Elo and is never fed back into objective classification. It is derived only for an identity-matched `MaiaMoveReview`, stored with its evidence in `MoveAnalysis.human`, and rendered with a quieter symbol family than objective Move Quality.

Its probability baseline is:

| Maia played-move probability | Base score | Band |
| --- | ---: | --- |
| at least 30% | 12 | common |
| 15–30% | 30 | plausible |
| 6–15% | 50 | uncommon |
| 2–6% | 70 | rare |
| below 2% | 88 | very rare |

Evidence then adjusts the 0–100 score: an engine-best move with a critical Stockfish top-two gap `+7`, at least 30 legal moves `+6`, at most five legal moves `-6`, forcing check/capture `-6`, verified sacrifice `+8`, one tactical motif `+3`, or multiple motifs `+6`. An only-legal move is fixed to score 5. Final labels use 0–21 Natural, 22–41 Findable, 42–61 Hard, 62–81 Very Hard and 82–100 Exceptional. Every adjustment is stored as machine-readable evidence and displayed on demand.
