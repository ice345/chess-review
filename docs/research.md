# Upstream research

Research snapshot: 2026-08-22. Repositories are shallow clones under `references/` and are ignored by Git. Commit hashes below make the observations reproducible.

## cooperbuilds/chess-game-analyzer (`ddcb10d`)

- Relevant files: `engine/stockfishEngine.ts`, `engine/stockfishPool.ts`, `engine/protocol.ts`, `lib/analysis/runAnalysis.ts`, `lib/analysis/classify.ts`, `lib/analysis/accuracy.ts`, `types/analysis.ts`, `components/board/ChessBoard.tsx`.
- Already solves: a coherent browser Game Review flow, Stockfish 18 WASM worker transport, bounded worker pool, MultiPV parsing, PGN replay, board navigation, review composition, and a broad label taxonomy.
- Reuse: the Stockfish 18 worker assets and the small worker/protocol architecture. Preserve the useful separation between engine transport and review composition.
- Do not reuse unchanged: arithmetic-mean game accuracy, PGN-prefix-only opening matching, UI-owned analysis concepts, or the heuristic Elo estimate.
- Weakness: `detectSacrifice()` only checks whether a minor-or-larger moved piece can be captured on its destination. It does not perform SEE, inspect the best response, track PV recovery, or distinguish compensation and routine recaptures.
- Integration: use as the Phase 0 browser baseline, while replacing product algorithms with canonical packages and structured evidence.

## WintrCat/wintrchess (`d145b20`)

- Relevant files: `client/src/apps/features/analysis/pages/Analysis`, `components/AnalysisPanel`, `components/EvaluationBar`, `components/report/EvaluationGraph`, `shared/src/lib/reporter/classify.ts`, `classification/brilliant.ts`, `classification/critical.ts`.
- Already solves: strong board/panel proportions, responsive analysis workspace, report/analysis tabs, realtime engine presentation, and a richer critical/brilliant heuristic than a hanging-destination check.
- Reuse: composition patterns, navigation placement, separate report and engine modes, and explicit guards for forced moves and free captures.
- Do not reuse unchanged: its classification names and thresholds as authoritative rules, raster classification assets, or its complete application architecture.
- Weakness: unsafe-piece and danger-level heuristics are useful but are not a substitute for a full SEE plus best-response/PV compensation check.
- Integration: visual reference only; selected classifier ideas become evidence fields in `packages/analysis`.

## lichess-org/lila (`5b90515`)

- Relevant files: `modules/analyse/src/main/AccuracyPercent.scala`, `modules/analyse/src/test/AccuracyPercentTest.scala`, `modules/tree/src/main/eval.scala`.
- Already solves: per-move accuracy from WinPercent and game accuracy as the mean of a volatility-weighted mean and harmonic mean. Window size is `clamp(plies / 10, 2, 8)`; weights are windowed WinPercent standard deviation clamped to `[0.5, 12]`.
- Reuse: behavior-level port of `fromWinPercents`, `gameAccuracy`, `phaseAccuracies`, including the `+1` uncertainty bonus and short-game behavior.
- Do not reuse: unrelated Lila application types or database structures.
- Weakness/constraint: phase accuracy inherits the upstream slice behavior; it should be compatibility-tested rather than “cleaned up” silently.
- Integration: `packages/analysis/src/accuracy.ts` with numeric regression tests.

## lichess-org/scalalib (`3151c43`)

- Relevant file: `lila/src/main/scala/Maths.scala`.
- Already solves: the exact helper semantics used by Lila Accuracy: population standard deviation, weighted mean and harmonic mean.
- Reuse: behavior-level helpers. In particular, harmonic mean uses `1 / max(1, value)` rather than dividing by zero or returning zero immediately.
- Integration: `packages/analysis/src/math.ts` with a zero-accuracy regression fixture.

## lichess-org/scalachess (`ed12438`)

- Relevant files: `core/src/main/scala/eval.scala`, `core/src/main/scala/Divider.scala`, `test-kit/src/test/scala/DividerTest.scala`.
- Already solves: canonical WinPercent curve, signed mate mapping through a 1000-cp ceiling, and structural game division using piece count, sparse back ranks, and 2×2-region mixedness.
- Reuse: constants and behavior exactly: `MULTIPLIER = -0.00368208`, CP ceiling `1000`, initial CP `15`; middlegame when non-pawn/non-king pieces `<=10`, a back rank has fewer than four home-color pieces, or mixedness `>150`; endgame at `<=6`.
- Do not reuse: Scala-specific board/bitboard plumbing.
- Integration: TypeScript ports in the UI-independent analysis package, with real-PGN fixtures.

## lichess-org/chess-openings (`4b86227`)

- Relevant files: `README.md`, `a.tsv` through `e.tsv`, `bin/gen.py`.
- Already solves: curated ECO/name/PGN data and generated UCI/EPD positions. Its documented recommendation is to walk positions backward until a named position is found, which handles transpositions.
- Reuse: EPD-position lookup, name conventions, and the backward-match algorithm.
- Do not reuse: raw TSV in browser bundles or PGN-prefix matching.
- Integration: `packages/openings/scripts/build-openings.mjs` generates a compact 3,810-position EPD index; production lookup walks analyzed positions backward.

## official-stockfish/Stockfish (`229f633`)

- Relevant areas: `src/`, UCI protocol behavior, release/version metadata.
- Already solves: objective evaluation, mate, best move, PV and MultiPV search.
- Reuse: Stockfish remains the canonical objective engine. The browser currently uses the Stockfish.js 18 build carried by the cooper reference.
- Do not reuse: engine internals inside product classification code, or centipawn assumptions for mate scores.
- Integration: browser worker now; native UCI adapter later behind the same result contract.

## CSSLab/maia3 (`1e13597`)

- Relevant files: `README.md`, `maia3/models.py`, `maia3/uci.py`, `maia3/model_registry.py`.
- Already solves: 5M/23M/79M human-move transformer models, Elo/SelfElo/OppoElo conditioning, Temperature, TopP, MultiPV and a human WDL head.
- Reuse: UCI process integration and explicit model/config metadata. Human move logits/probabilities and WDL must remain distinct from objective evaluation.
- Do not reuse: its GUI-compatible centipawn field as Stockfish truth; the README explicitly says it is derived from human WDL rather than search evaluation.
- Integration: optional local service, initially with the 5M CPU-friendly model.

## CSSLab/maia-platform-frontend (`a6e52f5`)

- Relevant files: `src/lib/engine/maia.ts`, `src/lib/engine/stockfish.ts`, `src/hooks/useAnalysisController/useEngineAnalysis.ts`, `src/types/analysis.ts`.
- Already solves: worker-based browser Maia inference, model download/storage, and side-by-side Maia/Stockfish orchestration.
- Reuse: separate engine identities, status/progress state, and delayed/cancellable analysis when users navigate rapidly.
- Do not reuse: application-specific state or assume its browser model path is suitable for the local-service-first enhanced mode.
- Integration: UX/data reference for the Human tab.

## LeelaChessZero/lc0 (`d8ce482`)

- Relevant areas: UCI frontend and backend abstraction.
- Already solves: neural search offering a strategic second opinion.
- Reuse: only the generic UCI-adapter lesson.
- Do not reuse: Lc0 as a human model or objective canonical replacement.
- Integration: optional post-MVP engine provider.

## dev-arcturus/positional_chess (`efefb3c`)

- Relevant files: `client/src/engine/explainer.js`, `engine-rs/src/see.rs`, `engine-rs/src/motifs.rs`, `client/src/components/QualityIcon.jsx`.
- Already solves: x-ray-aware swap-off SEE, many deterministic motifs, structured explanation facts, critical move gaps, decided-position and obvious-capture guards, and project-owned SVG icons.
- Reuse: SEE design, explicit `only legal` versus `only good` distinction, and Brilliant/Great exclusions.
- Do not reuse unchanged: its label thresholds or “complexity = candidates within 50 cp” as scientific human difficulty.
- Weakness: even SEE alone cannot prove compensation; final Brilliant evidence must include the opponent's best response and PV material recovery.
- Integration: `packages/analysis/src/sacrifice.ts` adapts the swap-off/recomputed-attacker approach to TypeScript and extends it with Stockfish root-PV best-response, material-recovery and evaluation-compensation evidence. Product thresholds and schema remain project-owned.

## imutkarsht/Chess_analyzer (`516a989`)

- Relevant files: `src/backend/analysis/move_classifier.py`, `src/gui/analysis/move_cell_widget.py`, `src/gui/views/metrics/ai_coach_card.py`, `assets/_generator/icons.py`.
- Already solves: desktop analysis composition, opening explorer, move-cell presentation, and icon generation.
- Reuse: visual consistency and coach-card information hierarchy.
- Do not reuse: raster/trademark-adjacent icon assets or Python GUI coupling.
- Integration: inspiration for the repository-owned SVG system in `packages/ui`.

## SikamikanikoBG/patzer (`75e356f`)

- Relevant files: `server/src/coach/review.ts`, `server/src/coach/prompts.ts`, `server/src/coach/ollama.ts`.
- Already solves: small structured LLM calls, JSON retry/fallback, progress events, prompt versioning, and grounded phase/key-moment summaries.
- Reuse: facts-first prompts, versioned prose cache, constrained JSON, and deterministic fallback copy.
- Do not reuse: estimated Elo claims or any unvalidated prose chess fact.
- Integration: design reference for the provider-neutral coach service.

## SailingSF/chesslens-core (`ec30961`)

- Relevant files: `analysis/context.py`, `analysis/priority.py`, `explanation/prompts/chat.yaml`, `chess_engine/service.py`.
- Already solves: engine → context assembly → priority logic → explanation layering, candidate gaps, opening/tactical facts, and tool-backed variation checks.
- Reuse: strict engine-grounded context and validation/re-analysis of hypothetical lines.
- Do not reuse unchanged: Chess.com-calibrated expected-points thresholds as Lichess Accuracy or a canonical public standard.
- Integration: supports the rule that LLMs narrate structured facts and never override engines.

## Resulting decisions

1. Canonical objective data lives in shared/core packages and uses White POV.
2. WinPercent, Accuracy and Divider are selected upstream ports, not tunable UI helpers.
3. Opening recognition is position-based and independent of Divider.
4. MultiPV defaults to three; “only move” always distinguishes legal forcing from objective uniqueness.
5. Brilliant is available only when structured SEE/best-response/PV evidence proves more than a hanging destination.
6. Maia and LLM work are optional enrichments after objective review becomes usable.
