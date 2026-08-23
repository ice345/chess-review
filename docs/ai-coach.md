# AI coach

Phase 4 is implemented as a language layer over canonical analysis facts. The coach never receives a bare FEN as its source of truth and cannot mutate Stockfish evaluation, Accuracy, phase, opening, classification or Maia data.

## Request flow

`packages/analysis` builds versioned `CoachMoveFacts` and `CoachGameFacts`. A move request includes before/after FEN, legal SAN/UCI, phase, White-POV scores, MultiPV and post-move PV, complete classification evidence, deterministic material/capture/check/motif facts, opening and phase Accuracy, plus Maia facts only when they have already been requested. Game requests contain canonical player summaries, move records and critical moments.

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

`/health` reports the Ollama service and the configured Ollama model separately. An available API with a missing model is not coach-ready. The UI directs the user to an explicit `ollama pull <model>` command, but neither the service nor the development launcher downloads a model automatically.

For development, `pnpm dev` probes and reuses an existing Ollama API or starts the installed executable with `ollama serve`. It also reuses or owns the optional FastAPI service and Next.js application, and shuts down only processes it created. `pnpm dev:local-ai` is the service-only companion for an already-running web app. `pnpm dev:web` starts Browser Core without managed local services. Human and Coach pages retry offline health automatically; provider/model/language defaults live in Settings instead of dominating the Coach route.

## Validation and grounding

Provider output must first match the strict Pydantic schema. Every returned line must then be an exact prefix of a supplied engine PV and is replayed move by move with `python-chess`; the service emits validated UCI and SAN rather than trusting model notation. Legal but unsupplied variations and ungrounded move mentions are removed. `humanPerspective` is removed without Maia facts, and `tacticalIdea` is removed without motif or sacrifice evidence. Removed claims lower confidence and appear in the grounding report.

The response records provider, model, `coach-v1` prompt version, generation time, validated-line count and grounding removals. If the provider is offline, unconfigured, times out, exhausts its budget, emits malformed JSON or fails validation, the web app immediately renders a deterministic explanation from the same canonical facts. The failure never blocks objective review.

Generated move explanations and game summaries are written back to the existing IndexedDB analysis record. Cached coach text is retained only when its `promptVersion` matches the current prompt contract, so objective analysis can be reused while stale prose is discarded.
