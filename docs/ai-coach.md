# AI coach

Phase 4 is implemented as a language layer over canonical analysis facts. The coach never receives a bare FEN as its source of truth and cannot mutate Stockfish evaluation, Accuracy, phase, opening, classification or Maia data.

## Request flow

`packages/analysis` builds versioned `CoachMoveFacts` and `CoachGameFacts`. A move request includes before/after FEN, legal SAN/UCI, phase, White-POV scores, MultiPV and post-move PV, V2 quality plus annotations, complete classification/consistency/verification evidence, opening and phase Accuracy, plus Maia facts only from the same persisted identity-matched `human-v2` move review shown by Review. Runtime position WDL is never substituted for played-move facts. Game requests contain canonical player summaries, move records and critical moments.

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

`/health` reports the Ollama service, configured default and every installed model returned by `/api/tags`. Enhanced Local Settings presents that catalog as a selector, so users are not restricted to `gemma4:12b-it-qat`. An available API with a missing selected model is not coach-ready. Setup guidance lives in Help; neither the service nor the development launcher downloads a model automatically.

For development, `pnpm dev` probes and reuses an existing Ollama API or starts the installed executable with `ollama serve`. It also reuses or owns the optional FastAPI service and Next.js application, and shuts down only processes it created. `pnpm dev:local-ai` is the service-only companion for an already-running web app. `pnpm dev:web` starts Browser Core without managed local services. Review's Maia selection and Study generation retry offline health automatically; provider/model/language defaults live in Settings instead of dominating the Study route.

## Deterministic whole-game summary

When no provider answers, `buildDeterministicGameCoach()` writes the summary from
canonical facts only. Its counting and wording rules are part of the contract:

- **Two layers stay apart.** Quality claims consume `qualityCounts`; special
  semantics consume `annotationCounts`. Book and Forced are annotations, never
  quality bands, so they cannot inflate a claim about the engine's first choice.
  `CoachGameFacts.players` carries both layers explicitly, which is the shape the
  local-ai schema already expected. A V1 record has neither, so the compatibility
  projection is used as the documented fallback — including Critical being
  projected as `great` and Sacrifice having no projection at all.
- **The wording names exactly the counted set.** The summary counts moves that
  matched the engine's first choice (`best`) and mentions Excellent separately as
  "within two win-percentage points". It never says "Best or better".
- **Key moments are explained from their own evidence.** A Brilliant, Critical,
  missed win or missed mate annotation produces its own sentence; otherwise the
  sentence states the recorded loss. A zero-loss annotated moment is never
  described as a "0.0-point swing".
- **No invented causes.** A Blunder proves a large loss, never which tactic was
  missed. The error recommendation is titled "Error review" and its advice is a
  generic check of forcing moves, captures and threats. This build detects one
  tactical motif (`sacrifice`), and the summary claims nothing beyond it.
- **Confidence describes the record, not the prose.** It is `high` when selective
  verification re-searched every move, `medium` when it re-searched some, and
  `low` when the summary rests on the baseline search. `CoachGameFacts.moves[].verified`
  carries that fact. The Study main layer never prints `deterministic`,
  `canonical-facts` or a bare confidence token. It says the summary was written
  from this game's analysis and labels confidence by what it measures (every
  position re-checked, some re-checked, or the original search). Provider, model,
  facts version, validated-line counts and fallback reason stay inside
  **Why this explanation?**.

Bumping these semantics bumps `COACH_PROMPT_VERSION` (`coach-v4`), which
invalidates cached deterministic and provider text alike.

## Validation and grounding

Public production defaults to Browser Core. It never probes localhost AI and
Study builds matching-language summaries from the existing canonical facts on
request. Provider/model controls are shown only in Enhanced Local on a loopback
hostname. Two languages meet on the Study/coach surface and they are chosen
separately. **Interface language** (Settings → Language, English or 简体中文,
default English) owns the panel's own words: headings, buttons, status, empty
states, the accuracy line and the grounding disclosure. **Coach output language**
owns the lesson: its prose and the section labels that caption that prose, so a
Chinese lesson is not headed in English and an English interface is not headed in
Chinese. The interface preference covers the lesson panel today; the rest of the
workspace, including outward navigation, is English.
Full capability, timeout and data-disclosure rules are in [web-service-boundaries.md](web-service-boundaries.md).

Provider output must first match the strict Pydantic schema. Coach v4 keeps the v3 response contract: the six nullable teaching keys `notice`, `moveIdea`, `problem`, `consequence`, `practicalAlternative` and `takeaway` are required, and a provider that silently returns the old shape fails validation. What v4 changes is the deterministic text and its counting rules (above), so cached prose from either provider is invalidated with it. Both move explanations and whole-game summaries are validated against the requested language. A Chinese request that contains no meaningful Chinese output fails closed to deterministic Chinese copy. The UI presents the available values in that order and keeps source cards and validated lines separate from the teaching prose.

Every returned line must be an exact prefix of a supplied engine PV and is replayed move by move with `python-chess`; the service emits validated UCI and SAN rather than trusting model notation. Legal but unsupplied variations and ungrounded move mentions are removed. `humanPerspective` is removed without Maia facts, `tacticalIdea` is removed without motif or sacrifice evidence, `consequence` is removed without `futureConsequence`, and `practicalAlternative` is removed without the deterministic Stockfish/Maia comparison. Empty or string-valued `null` fields are normalized to absent. Removed claims lower confidence and appear in the grounding report.

The response records provider, model, requested language, `coach-v4` prompt version, generation time, validated-line count and grounding removals. Cached text from another language is hidden instead of being shown under the current language setting. If the provider is offline, unconfigured, times out, exhausts its budget, emits malformed JSON or fails validation, the web app immediately renders matching-language deterministic copy from canonical facts. The failure never blocks objective review.

Generated move explanations and game summaries are written back to the existing IndexedDB analysis record. The active request is owned by the persistent review runtime rather than the Study route component, so moving among Review, Moves and Study does not cancel generation; the Study navigation item exposes its background-running state and the result is visible when the user returns. Cached coach text is retained only when its `promptVersion` and requested language match the current contract. Replacing or invalidating a move's Maia model/Elo enrichment also removes that move's Coach response and the whole-game Coach summary, because either may have incorporated the previous human assumptions. Objective analysis remains reusable while stale prose is discarded.

The visible product surface is Study, while the stable URL and stored schema keep the existing `coach` name.

Study's first screen is action, then lesson, then provenance:

1. **One learning action.** The primary button is **Build whole-game study** (zh-CN: **生成本局总结**), including Browser Core and when the local service is missing. A missing provider is a state, not a failure page: the screen says a summary can still be built from this game's own analysis and keeps that button enabled. Generation stays lazy, on demand and abortable.
2. **The lesson.** Whole-game study first, then the selected move. Move references use `formatMoveNotation` (`10. Nxb5`), never `Ply N`. When facts cannot support personalised depth — no key moments, no Maia facts, no re-checked lines — Study states that the summary is a numerical overview and offers a concrete check (walk the game and compare with the engine's first choice) instead of presenting the generic template as individual guidance.
3. **Provenance last.** Service, provider, language and configuration sit below the lesson. A working facts fallback is not shown with error styling.

Review owns detailed Stockfish/Maia facts. Rapid generation is guarded by one active abortable request. The request remains attached to the exact move/game fact snapshot even if the canonical cursor changes; completion is persisted only when rebuilding those facts still produces the same snapshot. Leaving the review workspace aborts owned work, while ordinary nested-route navigation does not.
