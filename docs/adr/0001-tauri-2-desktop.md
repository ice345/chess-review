# ADR 0001: Tauri 2 desktop architecture

- Status: accepted; Phase 6 foundation implemented
- Date: 2026-08-23

## Context

Open Chess Review already has substantial React, TypeScript, Stockfish WASM, chess-analysis packages, charts and shared schemas. A desktop application needs native file integration and managed local capabilities without rewriting those working layers.

Tauri consumes static frontend assets and does not supply a normal Next.js SSR server runtime. The remotely served web application also cannot safely start local executables.

## Decision

Keep `apps/web` as the Next.js web product. Add a separate `apps/desktop` in Phase 6 using Vite, React and Tauri 2. Both applications will reuse the canonical workspace packages:

```text
apps/web       Next.js
apps/desktop   Vite + React + Tauri 2

packages/ui
packages/chess-core
packages/analysis
packages/stockfish
packages/openings
packages/shared
```

The desktop Rust host will own native lifecycle responsibilities. The planned runtime sequence is:

```text
Tauri starts
  -> start packaged local-ai sidecar when enabled
  -> probe the Ollama HTTP API
       -> reuse an existing service without owning it
       -> otherwise locate and start `ollama serve`
  -> inspect the configured model list
       -> use an installed model
       -> otherwise request explicit approval before any pull
```

Owned child processes may be stopped during application shutdown. Pre-existing Ollama or local services must never be terminated by Open Chess Review.

The local-ai Python packaging strategy will be validated in Phase 6. Candidate approaches include a platform-specific self-contained sidecar binary or a bundled runtime with a narrow launcher. A development shell script is not an acceptable release architecture.

## Consequences

- No Flutter/Dart rewrite is planned.
- Web and desktop can evolve for their runtime constraints while sharing product logic and visual components.
- macOS, Windows and Linux are initial targets.
- Mobile remains exploratory; heavy Gemma/Maia workloads are not assumed to fit ordinary phones.
- Phase 5 may prepare shared UI boundaries and development orchestration, but it does not claim desktop packaging or releases.

## Implementation note

Phase 6 opened on 2026-08-24 with a static Vite/React frontend and minimal Tauri
Rust host under `apps/desktop`. The shell imports `@chess-review/ui` and
`@chess-review/chess-core` directly. No native lifecycle permission or sidecar
plugin is enabled yet; those remain separate reviewed milestones. See
[`../desktop.md`](../desktop.md).
