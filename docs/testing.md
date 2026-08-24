# Testing and continuous integration

## Test layers

- Package Vitest suites cover canonical TypeScript algorithms, schemas, browser orchestration helpers and state models.
- `services/local-ai/tests` covers FastAPI schemas, Maia/provider behavior, Coach validation and deterministic grounding in Python.
- Playwright workflow tests cover import, canonical navigation, orientation, legal user variation moves, Return to Game, mocked Maia availability/offline behavior and progressive large-library rendering.
- Playwright screenshot tests cover Home, White/Black board orientation, Brilliant/Blunder marks, a user variation, combined Stockfish/Maia evidence, deterministic grounded Coach copy and Library composition.

`e2e/fixtures.ts` builds review data through the real parser and analysis assembler, writes only deterministic records to IndexedDB, and mocks the local-ai HTTP boundary. Tests must not require live Chess.com, Lichess, Maia, Ollama or cloud credentials.

## Commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
uv run --project services/local-ai --extra dev pytest services/local-ai/tests
```

Screenshot baselines live in `e2e/__screenshots__`. After visually reviewing an intentional UI change, regenerate them with `pnpm test:e2e:update`; do not accept a changed image only to make CI green.

The E2E web server uses `pnpm dev:web`, so browser workflows validate Browser Core's offline boundary. The CI E2E job runs the semantic workflow suite on Linux. The committed visual suite remains available for reviewed local regression runs; platform-specific baselines can be added when the release matrix is introduced.

## CI

`.github/workflows/ci.yml` has three independent, dependency-cached jobs:

1. TypeScript typecheck, lint, package tests and production build.
2. Python local-ai tests through the locked uv environment.
3. Chromium workflow E2E with Playwright-managed browser dependencies.

No CI job starts the managed local service or contacts a chess platform. Failure traces and screenshots from the E2E job are uploaded for diagnosis.
