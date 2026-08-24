# Architecture

## Product layers

```text
Stockfish (objective) ─┐
                      ├─> versioned structured facts ─> UI / export / cache
Maia-3 (human model) ──┘                    │
                                           └─> LLM coach (explanation only)
```

Stockfish is canonical for evaluation, mate, best move, candidate lines and objective classification. Maia predicts Elo-conditioned human behavior. The LLM turns validated facts into language; it does not calculate canonical chess facts.

## Repository boundaries

- `apps/web`: Next.js route shell, import/history/settings UX and browser orchestration.
- `apps/desktop`: reserved for a future Vite + React + Tauri 2 shell; it will reuse shared packages rather than copy chess logic.
- `packages/chess-core`: PGN/FEN normalization and deterministic chess primitives.
- `packages/analysis`: score semantics, WinPercent, Accuracy, Divider, classification and evidence.
- `packages/stockfish`: UCI parsing, browser worker transport and deterministic cache keys.
- `packages/openings`: EPD index and backward position recognition.
- `packages/shared`: versioned schemas shared by analysis, services, UI and export.
- `packages/ui`: reusable presentation primitives, original Feather Annotation quality icons, quieter Human Find Difficulty marks and the Blue Bishop project mark.
- `services/local-ai`: optional Maia and provider-neutral grounded coaching.

No package below `apps/web` imports React except `packages/ui`. Neither web nor future desktop code may reconstruct canonical chess algorithms.

## Route information architecture

The web product uses Next.js App Router nested layouts:

```text
/
  Home / PGN or FEN import

/review/[gameId]
  persistent board workspace + objective context
  /moves
  /coach
  /engine

/history
/settings
```

`/review/[gameId]/layout.tsx` owns the persistent review shell. Client-side transitions replace only the contextual panel, preserving game, current ply, orientation, board position and engine runtime state. The shell is a normal scrolling document: the board and current-position study form the opening spread, followed by a full-width evaluation timeline. The import surface is not mounted inside review routes.

Imported review records receive a deterministic browser-side ID and are stored in IndexedDB. A record points back to PGN or normalized FEN input; it does not duplicate `GameAnalysisV1`. Objective analysis continues using its existing identity of algorithm version, Stockfish version, depth, MultiPV, initial FEN and PGN.

Current-position continuations use the existing `BrowserStockfish.search()` boundary. Search identity includes FEN, engine version, depth and MultiPV. Display length is presentation-only and never changes the cache key. UCI PVs are replayed through `packages/chess-core` before SAN or branch positions are shown. A branch has its own selected path and explicit root FEN; it never mutates the game cursor or canonical analysis.

The Phase 5.1 runtime replaces the temporary linear variation representation
with an analysis tree. A tree has an explicit canonical root ply/FEN, immutable nodes
whose edges contain rules-validated UCI/SAN moves, and an explicit selected path.
The selected node deterministically owns the displayed analysis FEN. Engine PVs
may be projected as selectable candidate paths, but they do not become user
branches or alter the canonical PGN merely by being displayed. Returning to the
game clears the selected branch and restores the root canonical position.
The complete runtime contract and current persistence boundary are documented in
[`analysis-variations.md`](analysis-variations.md).

Review orchestration separates record loading and position/game analysis into
dedicated hooks, with the evaluation bar as a small board-workspace component.
Presentation consumes package-owned facts;
the evaluation bar receives `EngineScore`, calls the one canonical
`winPercentFromScore()` conversion, and only then applies board-orientation
presentation. It does not contain its own centipawn curve.

Review's Maia selection is a separate optional runtime path with two explicit
contracts. Move review is keyed by canonical `fenBefore + played UCI + Maia model
+ target Elo`; exact-position analysis is keyed by displayed FEN plus model/Elo.
Stale output is hidden if any identity field changes during inference. Review has
Stockfish, Maia and Compare modes. Stockfish supplies canonical WinPercent; Maia
supplies side-to-move root human-game WDL; Compare keeps Stockfish as the primary
bar and adds a Maia marker. Only rules-validated candidate moves may enter the
analysis tree. No blended chess score is calculated, and human output never
changes objective Move Quality or canonical move facts.

Connected-platform providers normalize only account and game-import metadata. Chess.com uses the public Published Data API and produces an explicitly unverified username link. Lichess uses a public OAuth client with Authorization Code + PKCE (`S256`); tokens are encrypted into server-only HttpOnly cookies and are never stored in IndexedDB or exposed to the React bundle. Both providers page full history through persistent browser checkpoints, process requests serially and preserve the checkpoint on pause, failure or rate limit. See `docs/connected-platforms.md`.

## Analysis flow

```text
Home import -> normalized PGN/FEN -> persisted review ID -> review route
PGN -> opening EPD lookup -> structural Divider -> Stockfish queue
    -> White-POV facts -> classification/Accuracy -> GameAnalysisV1
    -> usable objective review -> optional Maia -> lazy coach request
```

Full-game work is queued through a browser pool capped at two Stockfish workers. A second `searchmoves` pass evaluates only played moves missing from MultiPV. Cancellation terminates active workers. Coach enrichments share the cached analysis record but are invalidated independently by prompt version.

Phase 5.1 uses one shared browser scheduler with two logical slots and three
priorities: current interactive board, interactive branch, then background
full-game review. Full-game pools use one worker so an interactive slot remains
available; queued jobs are priority ordered and stale current/continuation work
is cancelled with `AbortSignal`. Maia remains optional and is never allowed to
replace Stockfish score/classification ownership. See
[`analysis-scheduler.md`](analysis-scheduler.md).

## Execution modes and security boundary

The web application always supports Browser Core: PGN/FEN, Stockfish WASM, opening recognition, phases, classification, Accuracy, charts, navigation and exports. It may connect to an already-running local service, but a remotely served browser cannot launch local executables.

For local development, the project-level development orchestrator may start and own the Next.js process, FastAPI service and—only when no existing API is available—`ollama serve`. The launcher starts Browser Core before probing optional AI services, and an optional Ollama/FastAPI startup failure never tears down a healthy web process. `pnpm dev:local-ai` starts or reuses only the optional native services when Next.js is already running. The launcher tracks ownership and stops only children that it created. The installed Ollama catalog is discovered through `/api/tags` (the API equivalent of `ollama ls`), exposed to Settings for explicit user selection, and never downloaded automatically. Maia and Coach clients poll health while offline and reconnect without a page refresh.

The future desktop application may own native sidecars. Development process orchestration is not the production desktop packaging architecture.

## Local AI

The Maia adapter is optional and pinned to an official Maia-3 Git revision. It
offers separately typed move-review and exact-position endpoints, returns one
all-legal policy distribution plus bounded candidate/root WDL facts, and never
silently downloads a checkpoint. Settings exposes 5M/23M/79M status and an
explicit download action. The service releases the previous network before
allocating another tier so only one Maia model remains resident. Human Find
Difficulty is built from an identity-matched move review and remains a separate
deterministic evidence-bearing heuristic.

The coach accepts only versioned move/game fact payloads. Its rules layer derives bounded before/after position indicators, a short after-position Stockfish consequence and—only when both engines support it—a practical Maia/Stockfish alternative. Ollama and OpenAI Responses-compatible transports implement one provider contract; Pydantic validates JSON, and `python-chess` accepts only exact prefixes of canonical engine PVs before returning SAN. Coach v3 requires a nullable six-part teaching shape and validates both move and game output against the requested language; human, tactical, consequence and practical-alternative sections are removed when their source facts are absent. Provider failure falls back to deterministic browser copy with the same teaching order and language.

Screenshot/image OCR import is intentionally outside the product scope. Position PNG and Game Review PNG export remain supported.

## Desktop direction

The selected direction is implemented as a separate `apps/desktop` using Vite,
React and Tauri 2. Its foundation already imports `packages/ui` and
`chess-core`; later desktop review work will reuse `analysis`, `stockfish`,
`openings` and `shared` rather than copying them. The Next.js web application
remains optimized for the web and is not forced into a Tauri SSR runtime. See
[`desktop.md`](desktop.md).

Tauri will eventually manage a packaged local-ai sidecar, Ollama discovery/startup, model setup with explicit approval, process ownership and native file-open integration across macOS, Windows and Linux. See `docs/adr/0001-tauri-2-desktop.md`.

## Engineering verification

Critical browser workflows use deterministic Playwright fixtures backed by the
real parser, analysis assembler and IndexedDB contracts. The local-ai boundary is
mocked so CI never depends on Maia, Ollama or a cloud provider. Representative
visual baselines cover the principal workspace states and the complete Move
Quality V2 icon fixture. GitHub Actions
runs cached TypeScript, Python, build and browser-workflow jobs; see
[`testing.md`](testing.md).

## Current implementation status

Phases 0–5.2 are complete. Phase 6 is active: the independent Vite/React/Tauri 2
shell and its first shared-package imports are implemented and verified. Native
sidecar ownership, Ollama lifecycle, platform bundles, file-open integration and
release artifacts remain deliberately unchecked.
