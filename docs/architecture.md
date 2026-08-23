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
- `packages/ui`: reusable presentation primitives and original quality icons.
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
  /human
  /coach
  /engine

/history
/settings
```

`/review/[gameId]/layout.tsx` owns the persistent review shell. Client-side transitions replace only the contextual panel, preserving game, current ply, orientation, board position and engine runtime state. The shell is a normal scrolling document: the board and current-position study form the opening spread, followed by a full-width evaluation timeline. The import surface is not mounted inside review routes.

Imported review records receive a deterministic browser-side ID and are stored in IndexedDB. A record points back to PGN or normalized FEN input; it does not duplicate `GameAnalysisV1`. Objective analysis continues using its existing identity of algorithm version, Stockfish version, depth, MultiPV, initial FEN and PGN.

Current-position continuations use the existing `BrowserStockfish.search()` boundary. Search identity includes FEN, engine version, depth and MultiPV. Display length is presentation-only and never changes the cache key. UCI PVs are replayed through `packages/chess-core` before SAN or temporary variation positions are shown. A variation has its own cursor and root FEN; it never mutates the game cursor or canonical analysis.

Connected-platform providers normalize only account and game-import metadata. Chess.com uses the public Published Data API and produces an explicitly unverified username link. Lichess uses a public OAuth client with Authorization Code + PKCE (`S256`); tokens are encrypted into server-only HttpOnly cookies and are never stored in IndexedDB or exposed to the React bundle. See `docs/connected-platforms.md`.

## Analysis flow

```text
Home import -> normalized PGN/FEN -> persisted review ID -> review route
PGN -> opening EPD lookup -> structural Divider -> Stockfish queue
    -> White-POV facts -> classification/Accuracy -> GameAnalysisV1
    -> usable objective review -> optional Maia -> lazy coach request
```

Full-game work is queued through a browser pool capped at two Stockfish workers. A second `searchmoves` pass evaluates only played moves missing from MultiPV. Cancellation terminates active workers. Coach enrichments share the cached analysis record but are invalidated independently by prompt version.

## Execution modes and security boundary

The web application always supports Browser Core: PGN/FEN, Stockfish WASM, opening recognition, phases, classification, Accuracy, charts, navigation and exports. It may connect to an already-running local service, but a remotely served browser cannot launch local executables.

For local development, the project-level development orchestrator may start and own the Next.js process, FastAPI service and—only when no existing API is available—`ollama serve`. `pnpm dev:local-ai` starts or reuses only the optional native services when Next.js is already running. The launcher tracks ownership and stops only children that it created. The configured model is checked through the Ollama API and is never downloaded automatically. Human and Coach clients poll health while offline and reconnect without a page refresh.

The future desktop application may own native sidecars. Development process orchestration is not the production desktop packaging architecture.

## Local AI

The Maia adapter is optional and pinned to an official Maia-3 Git revision. It lazily loads CPU models and returns Elo-conditioned policy/WDL facts. Human Find Difficulty remains a separate deterministic evidence-bearing heuristic.

The coach accepts only versioned move/game fact payloads. Ollama and OpenAI Responses-compatible transports implement one provider contract; Pydantic validates JSON, and `python-chess` accepts only exact prefixes of canonical engine PVs before returning SAN. Unsupported human/tactical sections are removed when source facts are absent. Provider failure falls back to deterministic browser copy.

Screenshot/image OCR import is intentionally outside the product scope. Position PNG and Game Review PNG export remain supported.

## Desktop direction

The selected direction is a separate `apps/desktop` using Vite, React and Tauri 2, sharing `packages/ui`, `analysis`, `chess-core`, `stockfish`, `openings` and `shared`. The Next.js web application remains optimized for the web and is not forced into a Tauri SSR runtime.

Tauri will eventually manage a packaged local-ai sidecar, Ollama discovery/startup, model setup with explicit approval, process ownership and native file-open integration across macOS, Windows and Linux. See `docs/adr/0001-tauri-2-desktop.md`.

## Current implementation status

Phases 0–5 are complete. Phase 5 now includes connected-game sync, current-position study/variation state, a scroll-based editorial review composition and managed local-development orchestration. Phase 6 remains planned; no desktop application code is claimed complete yet.
