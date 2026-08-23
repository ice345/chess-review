# Human analysis

Maia-3 is an optional model of Elo-conditioned human behavior. It does not change Stockfish evaluation, Accuracy or objective classification.

The FastAPI adapter records model identity, target/self/opponent Elo, candidate UCI/SAN moves, raw policy probabilities, displayed candidate probability mass, exact played-move probability and human WDL. Maia3-5M is the CPU-friendly default; 23M and 79M are selectable quality tiers.

Maia-3 is an optional direct dependency pinned to the reviewed official Git revision `1e13597c42d4858b7cfd7cfdae01e297263364b2`. `services/local-ai/uv.lock` preserves that commit. Install and run it with:

```sh
cd services/local-ai
uv sync --extra dev --extra maia
uv run --extra maia uvicorn chess_review_local_ai.main:app --host 127.0.0.1 --port 8000
```

The provider imports Maia lazily, loads each requested model once, uses CPU without AMP by default and lets the official registry download its checkpoint from Hugging Face on first use. `/health` reports `available`, `not-installed` or `error`; an absent or failed optional service never disables browser Stockfish review. `/maia/moves` and its `/maia/analyze` alias return structured errors for missing runtime/model and inference failures.

At the repository root, `pnpm dev` manages web plus optional local services. If Next.js is already running, `pnpm dev:local-ai` starts or reuses only FastAPI/Ollama. A browser cannot start native processes itself; while offline the Human UI polls `/health` every five seconds and on window focus, then reconnects automatically.

The adapter asks Maia for all legal move policies internally, even though it only returns the requested Top-K candidates. This makes `playedMoveProbability` exact when the played move falls outside the displayed candidates. `candidateProbabilityMass` makes it explicit that a Top-K list need not sum to one. The returned WDL belongs to the played move when supplied, otherwise to Maia's top candidate.

Human WDL and the UCI-compatible centipawn field emitted by Maia are not Stockfish evaluation. UI labels must say “Maia model prediction” rather than implying an observed population frequency.

## Human Find Difficulty

Human Find Difficulty is a deterministic, separate experimental heuristic with labels Natural, Findable, Hard, Very Hard and Exceptional. It is not official Elo and is never fed back into objective classification.

Its probability baseline is:

| Maia played-move probability | Base score | Band |
| --- | ---: | --- |
| at least 30% | 12 | common |
| 15–30% | 30 | plausible |
| 6–15% | 50 | uncommon |
| 2–6% | 70 | rare |
| below 2% | 88 | very rare |

Evidence then adjusts the 0–100 score: an engine-best move with a critical Stockfish top-two gap `+7`, at least 30 legal moves `+6`, at most five legal moves `-6`, forcing check/capture `-6`, verified sacrifice `+8`, one tactical motif `+3`, or multiple motifs `+6`. An only-legal move is fixed to score 5. Final labels use 0–21 Natural, 22–41 Findable, 42–61 Hard, 62–81 Very Hard and 82–100 Exceptional. Every adjustment is stored as machine-readable evidence and displayed on demand.
