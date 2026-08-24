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
- `apps/desktop`: Vite + React + Tauri 2 shell; it reuses shared packages and owns native file/process integration rather than chess semantics.
- `packages/chess-core`: PGN/FEN normalization and deterministic chess primitives.
- `packages/analysis`: score semantics, WinPercent, Accuracy, Divider, classification and evidence.
- `packages/stockfish`: UCI parsing, browser worker transport and deterministic cache keys.
- `packages/openings`: EPD index and backward position recognition.
- `packages/shared`: versioned schemas shared by analysis, services, UI and export.
- `packages/ui`: reusable presentation primitives, geometric Move Quality Annotation System V3, quieter Human Find Difficulty marks and the Blue Bishop project mark.
- `services/local-ai`: optional Maia and provider-neutral grounded coaching.

No package below the application layer imports React except `packages/ui`. Neither web nor desktop code may reconstruct canonical chess algorithms.

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

Candidate arrows are presentation-only. Stockfish candidate actions validate the
root FEN, rank, full first-move UCI and complete PV identity before replay; Maia
candidate actions validate FEN, model, target Elo and full UCI. Exact-UCI overlap
gets a dual-source arrow in Compare, while moves that merely share a destination
remain distinct. This removes both destination guessing and source-order bias.

The visible `/coach` navigation label is Study. It consumes the same canonical
facts but does not duplicate Review's engine/model dashboards: whole-game learning
is primary, move lessons follow a fixed teaching sequence, and detailed grounding
is disclosed on demand. Review's contextual explanation action changes only the
nested route, preserving the selected ply and persistent board.

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

The desktop host owns only processes it starts: a target-triple PyInstaller
local-ai sidecar and, when no existing API is healthy, `ollama serve`.
Development process orchestration is not the production desktop packaging
architecture.

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

Tauri manages a packaged local-ai sidecar, Ollama discovery/startup, model setup
with explicit approval, process ownership and native PGN file-open integration.
The arm64 macOS package is verified locally, and native CI runners have verified
macOS arm64 app/DMG, Windows x64 NSIS and Linux x64 deb/AppImage artifacts. See
`docs/adr/0001-tauri-2-desktop.md`.

## Engineering verification

Critical browser workflows use deterministic Playwright fixtures backed by the
real parser, analysis assembler and IndexedDB contracts. The local-ai boundary is
mocked so CI never depends on Maia, Ollama or a cloud provider. Representative
visual baselines cover the principal workspace states and the complete Move
Quality Annotation System V3 fixture. GitHub Actions
runs cached TypeScript, Python, build and browser-workflow jobs; see
[`testing.md`](testing.md).

## Current implementation status

Phases 0–6 are complete. The independent Vite/React/Tauri 2 shell,
shared-package imports, native PGN integration, managed Ollama, packaged
local-ai ownership and the three-platform unsigned artifact matrix are
implemented and verified. Signing, notarization, universal macOS binaries and a
versioned public release remain explicit release-operations follow-ups.
