# AI coach

Phase 4 is implemented as a language layer over canonical analysis facts. The coach never receives a bare FEN as its source of truth and cannot mutate Stockfish evaluation, Accuracy, phase, opening, classification or Maia data.

## Request flow

`packages/analysis` builds versioned `CoachMoveFacts` and `CoachGameFacts`. A move request includes before/after FEN, legal SAN/UCI, phase, White-POV scores, MultiPV and post-move PV, complete classification evidence, opening and phase Accuracy, plus Maia facts only from the same persisted identity-matched `human-v2` move review shown by Review. Runtime position WDL is never substituted for played-move facts. Game requests contain canonical player summaries, move records and critical moments.

The move fact builder also replays both positions through `chess.js` and derives a bounded position-understanding object. It records legal-move count, checks, captures and other forcing candidates; attacked-and-undefended non-king pieces; center occupancy/contestation; open and semi-open files; king check/castling/pawn-shield indicators; undeveloped starting minors; and doubled, isolated and passed pawns. These are modest deterministic indicators, not an attempt to hide a second chess engine inside the Coach.

When a post-move Stockfish search is present, `futureConsequence` is an at-most-four-ply legal prefix from the resulting position and explicitly identifies the opponent's first response. A `practicalAlternative` is emitted only when the same non-best move appears in both Stockfish MultiPV and Maia candidates, costs no more than four canonical mover win-percentage points, has at least 12% Maia probability, and exceeds the objective best move's Maia probability by at least eight points. It remains an alternative, never a replacement for Stockfish's best move.

Generation is lazy. The browser calls `/coach/explain` only when the user requests the current move explanation and `/coach/game-summary` only when the user requests the whole-game summary. Stockfish analysis remains usable without the local service.

## Providers

The local service exposes one provider interface with two adapters:

- Ollama uses `POST /api/chat`, native JSON-schema output and the local default `gemma4:12b-it-qat`. Thinking output is disabled for this bounded structured response so the output budget is reserved for JSON.
- OpenAI-compatible uses `POST /v1/responses`, server-side bearer credentials, `store: false` and strict `text.format` JSON Schema. This follows the official [Responses create API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

Configuration is server-side:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `gemma4:12b-it-qat` | local model |
| `OLLAMA_NUM_CTX` | `8192` | context window |
| `OLLAMA_NUM_PREDICT` | `900` | maximum structured-output tokens |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Responses-compatible base URL |
| `OPENAI_API_KEY` | unset | server-only credential |
| `OPENAI_MODEL` | unset | default cloud/compatible model |

Selecting Ollama keeps facts local. Selecting the OpenAI-compatible provider is an explicit user action; API keys are never sent to the browser.

`/health` reports the Ollama service, configured default and every installed model returned by `/api/tags`. Settings presents that catalog as a selector, so users are not restricted to `gemma4:12b-it-qat`. An available API with a missing selected model is not coach-ready. The UI directs the user to an explicit `ollama pull <model>` command, but neither the service nor the development launcher downloads a model automatically.

For development, `pnpm dev` probes and reuses an existing Ollama API or starts the installed executable with `ollama serve`. It also reuses or owns the optional FastAPI service and Next.js application, and shuts down only processes it created. `pnpm dev:local-ai` is the service-only companion for an already-running web app. `pnpm dev:web` starts Browser Core without managed local services. Review's Maia selection and Coach retry offline health automatically; provider/model/language defaults live in Settings instead of dominating the Coach route.

## Validation and grounding

Provider output must first match the strict Pydantic schema. Coach v3 requires the six nullable teaching keys `notice`, `moveIdea`, `problem`, `consequence`, `practicalAlternative` and `takeaway`; a provider that silently returns the old shape fails validation. Both move explanations and whole-game summaries are validated against the requested language. A Chinese request that contains no meaningful Chinese output fails closed to deterministic Chinese copy. The UI presents the available values in that order and keeps source cards and validated lines separate from the teaching prose.

Every returned line must be an exact prefix of a supplied engine PV and is replayed move by move with `python-chess`; the service emits validated UCI and SAN rather than trusting model notation. Legal but unsupplied variations and ungrounded move mentions are removed. `humanPerspective` is removed without Maia facts, `tacticalIdea` is removed without motif or sacrifice evidence, `consequence` is removed without `futureConsequence`, and `practicalAlternative` is removed without the deterministic Stockfish/Maia comparison. Empty or string-valued `null` fields are normalized to absent. Removed claims lower confidence and appear in the grounding report.

The response records provider, model, requested language, `coach-v3` prompt version, generation time, validated-line count and grounding removals. Cached text from another language is hidden instead of being shown under the current language setting. If the provider is offline, unconfigured, times out, exhausts its budget, emits malformed JSON or fails validation, the web app immediately renders matching-language deterministic copy from canonical facts. The failure never blocks objective review.

Generated move explanations and game summaries are written back to the existing IndexedDB analysis record. Cached coach text is retained only when its `promptVersion` and requested language match the current contract. Replacing or invalidating a move's Maia model/Elo enrichment also removes that move's Coach response and the whole-game Coach summary, because either may have incorporated the previous human assumptions. Objective analysis remains reusable while stale prose is discarded.
